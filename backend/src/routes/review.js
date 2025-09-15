// routes/review.js
import express from "express";
import Review from "../models/Review.model.js";
import Service from "../models/Service.model.js";
import { requireAuth } from "../middleware/auth.js";
import { refreshServiceRating } from "../utils/reviewHelpers.js";
import mongoose from "mongoose";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";
import dotenv from "dotenv";
import Booking from "../models/Booking.model.js";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const router = express.Router();

// multer memory storage for review images (max 2)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 6 * 1024 * 1024 } // 6 MB per file (sensible limit)
});

// helper to upload buffer to Cloudinary
function uploadBufferToCloudinary(buffer, folder = "reviews") {
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
 * POST /api/reviews
 * Create a review for a service (user only)
 * Accepts multipart/form-data:
 * - fields: serviceId, rating, comment
 * - files: images (up to 2)
 */
router.post("/", requireAuth, upload.array("images", 2), async (req, res) => {
  try {
    const { serviceId, rating, comment } = req.body;
    if (!serviceId || !rating) return res.status(400).json({ error: "serviceId and rating are required" });

    // ensure service exists
    const service = await Service.findById(serviceId);
    if (!service) return res.status(404).json({ error: "Service not found" });

    // ensure user actually completed a booking for this service
    const hasCompletedBooking = await Booking.exists({
      userId: req.user.id,
      serviceId,
      status: "completed"
    });

    if (!hasCompletedBooking) {
      return res.status(403).json({ error: "You can only review services you have completed bookings for." });
    }
    // Collect images (if any)
    const images = [];
    if (req.files && req.files.length > 0) {
      if (req.files.length > 2) {
        return res.status(400).json({ error: "Maximum 2 images allowed" });
      }
      for (const f of req.files) {
        try {
          const uploaded = await uploadBufferToCloudinary(f.buffer, "reviews");
          images.push(uploaded);
        } catch (err) {
          console.error("Cloudinary upload failed for review image:", err);
          // You can decide: fail the whole request, or continue without this image.
          return res.status(500).json({ error: "Image upload failed" });
        }
      }
    }

    // create review
    const review = new Review({
      userId: req.user.id,
      serviceId,
      rating: Number(rating),
      comment: comment ? comment.toString().trim().slice(0, 2000) : undefined, // cap comment for safety
      images
    });

    try {
      const saved = await review.save();
      // refresh aggregate rating
try {
  await refreshServiceRating(saved.serviceId);
} catch (err) {
  console.error("Failed to refresh rating after creating review:", err);
  // don't fail the response — but log for debugging
}
      // populate user name for response
      await saved.populate("userId", "name").execPopulate?.(); // execPopulate for older mongoose; optional
      const populated = await Review.findById(saved._id).populate("userId", "name");

      return res.status(201).json(populated);
    } catch (err) {
      // duplicate key (user already reviewed service)
      if (err.code === 11000) {
        return res.status(409).json({ error: "You have already reviewed this service" });
      }
      throw err;
    }
  } catch (err) {
    console.error("POST /reviews error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/reviews/service/:id
 * Get all reviews for a service (public)
 * Optionally supports pagination ?page=&limit=
 */
router.get("/service/:id", async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "12", 10), 1), 50);

    const filter = { serviceId: req.params.id };
    const total = await Review.countDocuments(filter);
    const reviews = await Review.find(filter)
      .populate("userId", "name")
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.json({
      reviews,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1
    });
  } catch (err) {
    console.error("GET /reviews/service/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/reviews/user/:id
 */
router.get("/user/:id", async (req, res) => {
  try {
    const reviews = await Review.find({ userId: req.params.id })
      .populate("serviceId", "title")
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    console.error("GET /reviews/user/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * PUT /api/reviews/:id
 * Update your own review. To update images, client should resubmit images (multipart) and include imagesToKeep[] as URLs/public_ids they want kept.
 */
router.put("/:id", requireAuth, upload.array("images", 2), async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ error: "Review not found" });

    if (review.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not allowed to edit this review" });
    }

    // allowed fields
    if (req.body.rating !== undefined) review.rating = Number(req.body.rating);
    if (req.body.comment !== undefined) review.comment = req.body.comment.toString().trim().slice(0, 2000);

    // images handling: client can pass imagesToKeep as JSON array (objects or urls), and new files in images[]
    let imagesToKeep = [];
    if (req.body.imagesToKeep) {
      try {
        const parsed = JSON.parse(req.body.imagesToKeep);
        if (Array.isArray(parsed)) {
          imagesToKeep = parsed.map(it => {
            if (typeof it === "string") return { url: it, public_id: null };
            if (typeof it === "object") return { url: it.url || it.secure_url || null, public_id: it.public_id || null };
            return null;
          }).filter(Boolean);
        }
      } catch (e) {
        // if single url string or comma-separated fallback
        if (typeof req.body.imagesToKeep === "string" && req.body.imagesToKeep.trim()) {
          imagesToKeep = [{ url: req.body.imagesToKeep.trim(), public_id: null }];
        }
      }
    }

    const newImages = [];
    if (req.files && req.files.length > 0) {
      for (const f of req.files) {
        const uploaded = await uploadBufferToCloudinary(f.buffer, "reviews");
        newImages.push(uploaded);
      }
    }

    const combined = [...imagesToKeep, ...newImages];
    if (combined.length > 2) {
      return res.status(400).json({ error: "Maximum 2 images allowed per review" });
    }

    review.images = combined;

    const updated = await review.save();
    await refreshServiceRating(updated.serviceId);

    const populated = await Review.findById(updated._id).populate("userId", "name");
    res.json(populated);
  } catch (err) {
    console.error("PUT /reviews/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * DELETE /api/reviews/:id
 */
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ error: "Review not found" });

    if (review.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not allowed to delete this review" });
    }

    const serviceId = review.serviceId;
    await Review.findByIdAndDelete(req.params.id);

    // Optionally: delete images from Cloudinary here if you want to cleanup public_ids
    // for (const img of (review.images || [])) { cloudinary.uploader.destroy(img.public_id).catch(()=>{}); }

    // refresh aggregates
    await refreshServiceRating(serviceId);

    res.json({ message: "Review deleted" });
  } catch (err) {
    console.error("DELETE /reviews/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
