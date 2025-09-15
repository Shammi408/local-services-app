// src/routes/uploads.js
import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import streamifier from "streamifier";
import dotenv from "dotenv";
import { requireAuth } from "../middleware/auth.js";
import User from "../models/User.model.js";

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } }); // 8MB limit
// helper: upload buffer to Cloudinary
function uploadBufferToCloudinary(buffer, folder = "services", opts = {}) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: [{ width: 1600, crop: "limit", quality: "auto" }],
        ...opts,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve({ url: result.secure_url, public_id: result.public_id });
      }
    );
    streamifier.createReadStream(buffer).pipe(uploadStream);
  });
}
// POST /api/uploads/image  (single file)
// Requires authentication so only logged-in users can upload
router.post("/image", requireAuth, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const buffer = req.file.buffer;

    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: "services",
        resource_type: "image",
        transformation: [{ width: 1600, crop: "limit", quality: "auto" }],
      },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          return res.status(500).json({ error: "Upload failed" });
        }
        return res.json({ url: result.secure_url, public_id: result.public_id });
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  } catch (err) {
    console.error("POST /uploads/image error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /api/uploads/image/delete  (body: { public_id })
router.post("/image/delete", requireAuth, async (req, res) => {
  try {
    const { public_id } = req.body;
    if (!public_id) return res.status(400).json({ error: "public_id required" });

    const result = await cloudinary.uploader.destroy(public_id, { resource_type: "image" });
    // result.result === 'ok' on success, 'not found' etc otherwise
    return res.json({ ok: true, result });
  } catch (err) {
    console.error("POST /uploads/image/delete error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/uploads/avatar
 * Upload profile avatar. Expects multipart form with key "avatar".
 * This route updates the user's profilePic in DB (does NOT rely on req.user.save()).
 */
router.post("/avatar", requireAuth, upload.single("avatar"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    // Upload with face-focused crop and reasonable size for avatars
    const uploaded = await uploadBufferToCloudinary(req.file.buffer, "avatars", {
      transformation: [{ width: 600, height: 600, crop: "fill", gravity: "face" }],
    });

    // req.user may be just a JWT payload (not a Mongoose doc). Update the DB directly.
    const userId = req.user?.id ?? req.user?._id ?? null;
    if (userId) {
      await User.findByIdAndUpdate(userId, { profilePic: uploaded.url }, { new: true });
    } else {
      // If userId is not present, warn but still return uploaded URL (optional)
      console.warn("uploads.avatar: no user id found in req.user — avatar uploaded but not saved to profile");
    }

    return res.json(uploaded);
  } catch (err) {
    console.error("Avatar upload error:", err);
    return res.status(500).json({ error: "Failed to upload avatar" });
  }
});

export default router;
