// routes/uploads.js
import express from "express";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = express.Router();

// ensure uploads dir
const UPLOAD_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// disk storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = `profile-${req.user?.id || "anon"}-${Date.now()}${ext}`;
    cb(null, name);
  }
});

// accept only images and size limit
const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png/;
    const ok = allowed.test(file.mimetype) && allowed.test(path.extname(file.originalname).toLowerCase());
    cb(ok ? null : new Error("Only jpg/png allowed"), ok);
  }
});

router.post("/profile-pic", requireAuth, upload.single("file"), async (req, res) => {
  // req.file -> { filename, path, etc }
  if (!req.file) return res.status(400).json({ error: "No file uploaded" });

  // build public URL served by your static middleware, e.g. express.static('/uploads', ...)
  const url = `/uploads/${req.file.filename}`; // configure express.static in your main server
  return res.json({ url });
});

export default router;
