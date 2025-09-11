import express from "express";
import Review from "../models/Review.model.js";
import Service from "../models/Service.model.js";
import { requireAuth } from "../middleware/auth.js";
import { refreshServiceRating } from "../utils/reviewHelpers.js";
import mongoose from "mongoose";

const router = express.Router();

/**
 * POST /api/reviews
 * Create a review for a service (user only)
 * Body: { serviceId, rating, comment }
 * Note: unique index prevents multiple reviews by same user; return 409 if exists
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const { serviceId, rating, comment } = req.body;
    if (!serviceId || !rating) return res.status(400).json({ error: "serviceId and rating are required" });

    // ensure service exists
    const service = await Service.findById(serviceId);
    if (!service) return res.status(404).json({ error: "Service not found" });

    // create review
    const review = new Review({
      userId: req.user.id,
      serviceId,
      rating,
      comment
    });

    try {
      const saved = await review.save();
      // refresh aggregate rating
      await refreshServiceRating(saved.serviceId);

      return res.status(201).json(saved);
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
 */
router.get("/service/:id", async (req, res) => {
  try {
    const reviews = await Review.find({ serviceId: req.params.id })
      .populate("userId", "name")
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (err) {
    console.error("GET /reviews/service/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/reviews/user/:id
 * Get reviews written by a user (public or private depending on needs)
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
 * Update your own review (user only)
 */
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ error: "Review not found" });

    if (review.userId.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not allowed to edit this review" });
    }

    const allowed = ["rating", "comment"];
    allowed.forEach((field) => {
      if (req.body[field] !== undefined) review[field] = req.body[field];
    });

    const updated = await review.save();

    // refresh aggregates
    await refreshServiceRating(updated.serviceId);

    res.json(updated);
  } catch (err) {
    console.error("PUT /reviews/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * DELETE /api/reviews/:id
 * Delete your own review (user only)
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

    // refresh aggregates
    await refreshServiceRating(serviceId);

    res.json({ message: "Review deleted" });
  } catch (err) {
    console.error("DELETE /reviews/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
