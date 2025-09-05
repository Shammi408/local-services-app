import express from "express";
import User from "../models/User.model.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

/**
 * @route   GET /api/profile/:id
 * @desc    Get a user's profile (public view, no password shown)
 * @access  Public
 */
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-passwordHash");
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (err) {
    console.error("GET /profile error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * @route   PUT /api/profile/:id
 * @desc    Update a user's own profile
 * @access  Private (user must be logged in)
 */
router.put("/:id", requireAuth, async (req, res) => {
  try {
    // Only allow logged-in user to update their own profile
    if (req.user.id !== req.params.id) {
      return res.status(403).json({ error: "Not allowed to update this profile" });
    }

    const allowedFields = [
      "name",
      "phone",
      "address",
      "profilePic",
      "services",
      "experience",
    ];

    // Pick only allowed fields from req.body
    const updates = {};
    for (let field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select("-passwordHash");

    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(updatedUser);
  } catch (err) {
    console.error("PUT /profile error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
