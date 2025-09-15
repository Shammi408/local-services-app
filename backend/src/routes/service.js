// src/routes/service.js
import express from "express";
import Service from "../models/Service.model.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";
import dotenv from "dotenv";
import { verifyAccessToken } from "../utils/jwt.js";
import Review from "../models/Review.model.js";

dotenv.config();

// Cloudinary config (will use env vars; if missing uploads will fail as before)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const router = express.Router();

// multer memory storage (we will stream buffers to Cloudinary)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 } // 8 MB
});

// helper to escape regex special chars in user input
function escapeRegExp(str = "") {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// parse tags helper (accepts array, JSON string, or comma-separated string)
function parseTagsInput(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.map(String).map(s => s.trim()).filter(Boolean);
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(String).map(s => s.trim()).filter(Boolean);
    } catch (e) {
      // fallback to comma separated
      return trimmed.split(",").map(s => s.trim()).filter(Boolean);
    }
  }
  return [];
}

// normalize existingImages input to array of url strings
function parseExistingImages(input) {
  if (!input) return [];
  if (Array.isArray(input)) return input.map(String).filter(Boolean);
  if (typeof input === "string") {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
    } catch (e) {
      if (input.includes(",")) return input.split(",").map(s => s.trim()).filter(Boolean);
      return [input];
    }
  }
  return [];
}

// helper to upload a buffer to Cloudinary, returns { url, public_id }
function uploadBufferToCloudinary(buffer, folder = "services") {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: [{ width: 1600, crop: "limit", quality: "auto" }]
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, public_id: result.public_id });
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}

/**
 * POST /api/services
 * Create a new service (providers only).
 * Accepts multipart form with images[] or JSON body with images[] (array of {url, public_id})
 */
router.post("/", requireAuth, requireRole("provider"), upload.array("images", 5), async (req, res) => {
  try {
    const providerId = req.user.id || req.user._id;

    // tags can come as array or JSON string or comma-separated
    const tags = parseTagsInput(req.body.tags);

    // existingImages may be provided (when client already uploaded to cloudinary)
    const existingImages = parseExistingImages(req.body.images);

    // If client sent images as JSON array of objects {url, public_id}, parse:
    let imagesArr = [];
    if (req.body.images && typeof req.body.images === "string") {
      try {
        const parsed = JSON.parse(req.body.images);
        if (Array.isArray(parsed)) {
          imagesArr = parsed
            .map(it => {
              if (!it) return null;
              if (typeof it === "string") return { url: it, public_id: null };
              if (typeof it === "object") return { url: it.url || it.secure_url || null, public_id: it.public_id || null };
              return null;
            })
            .filter(Boolean);
        }
      } catch (e) {
        // ignore; fallback to parseExistingImages above
      }
    }

    // if there are files uploaded directly in multipart, stream them to Cloudinary
    if (req.files && req.files.length > 0) {
      for (const f of req.files) {
        const uploaded = await uploadBufferToCloudinary(f.buffer);
        imagesArr.push(uploaded);
      }
    }

    // also if existingImages contained raw URLs, merge them
    if (existingImages.length) {
      existingImages.forEach(url => imagesArr.push({ url, public_id: null }));
    }

    // Final fields
    const svc = new Service({
      title: (req.body.title || "").trim(),
      description: (req.body.description || "").trim(),
      category: (req.body.category || "").trim(),
      price: Number(req.body.price || 0),
      providerId,
      images: imagesArr,
      tags
    });

    await svc.save();
    res.status(201).json(svc);
  } catch (err) {
    console.error("POST /services error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/services
 * Supports search, providerId, category, tag, pagination
 * NOTE: City filter has been removed from the API and is no longer honored.
 */
router.get("/", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "12", 10), 1), 100);

    const q = req.query.q?.trim();
    const category = req.query.category?.trim();
    const providerId = req.query.providerId?.trim();
    const tag = req.query.tag?.trim();

    const filter = { isAvailable: true };

    // city filter intentionally removed

    if (category) filter.category = category;
    if (providerId) filter.providerId = providerId;
    if (tag) filter.tags = tag;
    if (q) {
      const re = new RegExp(escapeRegExp(q), "i");
      filter.$or = [
        { title: re },
        { description: re },
        { category: re },
        { tags: { $regex: re } },
      ];
    }

    const total = await Service.countDocuments(filter);
    const items = await Service.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("providerId", "name email phone");

    return res.json({
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    console.error("GET /services error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

// GET /api/services/mine
router.get("/mine", requireAuth, async (req, res) => {
  try {
    if (req.user.role !== "provider") {
      return res.status(403).json({ error: "Only providers can access their services" });
    }
    const services = await Service.find({ providerId: req.user.id }).sort({ createdAt: -1 });
    res.json(services);
  } catch (err) {
    console.error("GET /services/mine error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/services/tags
 * Return available tags (small curated list)
 */
router.get("/tags", async (req, res) => {
  try {
    const tags = ["tutoring", "plumbing", "grooming", "cleaning", "handyman"];
    res.json(tags);
  } catch (err) {
    console.error("GET /services/tags error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/services/:id
 * (MUST be after literal routes like /tags and /mine)
 *
 * This returns the service and, if a valid access token is included
 * in the Authorization header (Bearer ...) or cookie, adds `hasReviewed`
 * that indicates whether the current user already left a review.
 */
router.get("/:id", async (req, res) => {
  try {
    let service = await Service.findById(req.params.id).populate("providerId", "name email phone");
    if (!service) return res.status(404).json({ error: "Service not found" });

    // default
    let hasReviewed = false;

    // Try to get token from Authorization header or cookie and decode it.
    try {
      const header = req.headers["authorization"];
      const token = header && header.startsWith("Bearer ") ? header.slice(7) : req.cookies?.accessToken;

      if (token) {
        const payload = verifyAccessToken(token); // will throw if invalid/expired
        if (payload?.sub) {
          const existing = await Review.findOne({
            serviceId: service._id,
            userId: payload.sub
          }).lean();
          hasReviewed = !!existing;
        }
      }
    } catch (tokenErr) {
      // ignore: endpoint remains public
    }

    const out = service.toObject ? service.toObject() : { ...service };
    out.hasReviewed = hasReviewed;

    return res.json(out);
  } catch (err) {
    console.error("GET /services/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * PUT /api/services/:id
 * Accepts either JSON with images (array of {url, public_id}) OR multipart form-data (new files + existingImages[] + tags)
 */
router.put("/:id", requireAuth, requireRole("provider"), upload.array("images", 5), async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ error: "Service not found" });
    if (service.providerId.toString() !== req.user.id) return res.status(403).json({ error: "Not allowed to edit this service" });

    // Allowed simple fields
    const allowed = ["title", "description", "category", "price", "isAvailable"];
    allowed.forEach((f) => {
      if (req.body[f] !== undefined) {
        if (f === "price") service[f] = Number(req.body[f]);
        else if (f === "isAvailable") service[f] = (req.body[f] === "true" || req.body[f] === true);
        else service[f] = (req.body[f] || "").toString().trim();
      }
    });

    // tags
    const tags = parseTagsInput(req.body.tags);
    if (tags.length) service.tags = tags;

    // existingImages specified by client (keep them)
    const existingImages = parseExistingImages(req.body.existingImages || req.body["existingImages[]"]);

    // build new images array starting from kept existing images that are objects or URLs
    let imagesArr = [];
    if (existingImages && existingImages.length) imagesArr = existingImages.map(u => ({ url: u, public_id: null }));

    // If client posted images as JSON objects in body (images: JSON string)
    if (req.body.images && typeof req.body.images === "string") {
      try {
        const parsed = JSON.parse(req.body.images);
        if (Array.isArray(parsed)) {
          parsed.forEach(it => {
            if (!it) return;
            if (typeof it === "string") imagesArr.push({ url: it, public_id: null });
            else if (typeof it === "object") imagesArr.push({ url: it.url || it.secure_url || null, public_id: it.public_id || null });
          });
        }
      } catch (e) {
        // ignore
      }
    }

    // If files uploaded directly, upload each to Cloudinary and append
    if (req.files && req.files.length > 0) {
      for (const f of req.files) {
        const uploaded = await uploadBufferToCloudinary(f.buffer);
        imagesArr.push(uploaded);
      }
    }

    // if imagesArr is non-empty, set it
    if (imagesArr.length) service.images = imagesArr;

    const updated = await service.save();
    res.json(updated);
  } catch (err) {
    console.error("PUT /services/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});
/**
 * PATCH /api/services/:id
 * Partial updates for provider-owned service.
 * Currently allows updating only a small safe set of fields (isAvailable, title, description, category, price).
 * This keeps semantics simple and avoids multipart/form-data logic.
 */
router.patch("/:id", requireAuth, requireRole("provider"), async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ error: "Service not found" });
    if (service.providerId.toString() !== req.user.id) return res.status(403).json({ error: "Not allowed to modify this service" });

    // Allowed partial fields
    const allowed = ["isAvailable", "title", "description", "category", "price"];
    let changed = false;
    for (const f of allowed) {
      if (req.body[f] !== undefined) {
        changed = true;
        if (f === "price") service[f] = Number(req.body[f]);
        else if (f === "isAvailable") service[f] = (req.body[f] === "true" || req.body[f] === true);
        else service[f] = (req.body[f] || "").toString().trim();
      }
    }

    if (!changed) {
      return res.status(400).json({ error: "No updatable field provided" });
    }

    const updated = await service.save();
    res.json(updated);
  } catch (err) {
    console.error("PATCH /services/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});
/**
 * DELETE /api/services/:id
 */
router.delete("/:id", requireAuth, requireRole("provider"), async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ error: "Service not found" });
    if (service.providerId.toString() !== req.user.id) return res.status(403).json({ error: "Not allowed to delete this service" });

    await Service.findByIdAndDelete(req.params.id);
    res.json({ message: "Service deleted" });
  } catch (err) {
    console.error("DELETE /services/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
