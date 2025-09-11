import express from "express";
import Notification from "../models/Notification.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

router.get("/", requireAuth, async (req, res) => {
  try {
    const notes = await Notification.find({ userId: req.user.id }).sort({ createdAt: -1 }).limit(50);
    res.json(notes);
  } catch (err) {
    console.error("GET /notifications error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// Mark notification read
router.put("/:id/read", requireAuth, async (req, res) => {
  try {
    const note = await Notification.findById(req.params.id);
    if (!note) return res.status(404).json({ error: "Notification not found" });
    if (note.userId.toString() !== req.user.id) return res.status(403).json({ error: "Not allowed" });

    note.isRead = true;
    await note.save();
    res.json(note);
  } catch (err) {
    console.error("PUT /notifications/:id/read error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
