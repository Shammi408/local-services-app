import express from "express";
import Service from "../models/Service.model.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

// helper to escape regex special chars in user input
function escapeRegExp(str = "") {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

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
// router.get("/", async (req, res) => {
//   try {
//     const services = await Service.find({ isAvailable: true }).populate("providerId", "name email phone");
//     res.json(services);
//   } catch (err) {
//     console.error("GET /services error:", err);
//     res.status(500).json({ error: "Server error" });
//   }
// });
router.get("/", async (req, res) => {
  try {
    // parse query
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "12", 10), 1), 100); // clamp 1..100
    const q = req.query.q?.trim();
    const city = req.query.city?.trim();
    const category = req.query.category?.trim();
    const providerId = req.query.providerId?.trim();
    // base filter
    const filter = { isAvailable: true };

    if (city) {
      // case-insensitive contains match
      filter.city = { $regex: new RegExp(escapeRegExp(city), "i") };
    }
    
    if (category) {
      filter.category = category;
    }

    if (q) {
      // search title, description, category, tags
      const re = new RegExp(escapeRegExp(q), "i");
      filter.$or = [
        { title: re },
        { description: re },
        { category: re },
        { tags: { $in: [re] } }, // tags array
      ];
    }
    if (providerId) filter.providerId = providerId;
    // count total matching documents
    const total = await Service.countDocuments(filter);

    // fetch page
    const items = await Service.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("providerId", "name email phone"); // keep your populate

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

// PUT /api/services/:id  -> provider updates their service
router.put("/:id", requireAuth, requireRole("provider"), async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ error: "Service not found" });
    if (service.providerId.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not allowed to edit this service" });
    }

    const allowed = ["title", "description", "category", "price", "isAvailable"];
    allowed.forEach((f) => {
      if (req.body[f] !== undefined) service[f] = req.body[f];
    });

    const updated = await service.save();
    res.json(updated);
  } catch (err) {
    console.error("PUT /services/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// DELETE /api/services/:id -> provider deletes their service
router.delete("/:id", requireAuth, requireRole("provider"), async (req, res) => {
  try {
    const service = await Service.findById(req.params.id);
    if (!service) return res.status(404).json({ error: "Service not found" });
    if (service.providerId.toString() !== req.user.id) {
      return res.status(403).json({ error: "Not allowed to delete this service" });
    }

    await Service.findByIdAndDelete(req.params.id);
    res.json({ message: "Service deleted" });
  } catch (err) {
    console.error("DELETE /services/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});
//This is handy for a provider dashboard since it avoids trusting a frontend-supplied providerId.
router.get("/mine", requireAuth, async (req, res) => {
  try {
    const services = await Service.find({ providerId: req.user.id }).populate("providerId", "name email phone");
    return res.json(services);
  } catch (err) {
    console.error("GET /services/mine error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
