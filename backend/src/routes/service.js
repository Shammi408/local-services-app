import express from "express";
import Service from "../models/Service.model.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

/**
 * @route   POST /api/services
 * @desc    Create a new service (providers only)
 * @access  Private (provider)
 */
router.post("/", requireAuth, requireRole("provider"), async (req, res) => {
  try {
    const { title, description, category, price } = req.body;

    const newService = new Service({
      title,
      description,
      category,
      price,
      providerId: req.user.id
    });

    const savedService = await newService.save();
    res.status(201).json(savedService);
  } catch (err) {
    console.error("POST /services error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * @route   GET /api/services
 * @desc    Get all available services
 * @access  Public
 */
router.get("/", async (req, res) => {
  try {
    const services = await Service.find({ isAvailable: true }).populate("providerId", "name email phone");
    res.json(services);
  } catch (err) {
    console.error("GET /services error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * @route   GET /api/services/:id
 * @desc    Get a single service by ID
 * @access  Public
 */
router.get("/:id", async (req, res) => {
  try {
    const service = await Service.findById(req.params.id).populate("providerId", "name email phone");
    if (!service) {
      return res.status(404).json({ error: "Service not found" });
    }
    res.json(service);
  } catch (err) {
    console.error("GET /services/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
