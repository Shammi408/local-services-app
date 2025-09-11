// routes/providers.js
import express from "express";
import Booking from "../models/Booking.model.js";
import Service from "../models/Service.model.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

/**
 * GET /api/providers/me/services
 * Return services owned by the logged-in provider
 */
router.get("/me/services", requireAuth, requireRole("provider"), async (req, res) => {
  try {
    const services = await Service.find({ providerId: req.user.id })
      .sort({ createdAt: -1 })
      .populate("providerId", "name email phone");
    return res.json(services);
  } catch (err) {
    console.error("GET /providers/me/services error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/providers/me/bookings
 * Return bookings for the logged-in provider. Optional ?status=...
 */
router.get("/me/bookings", requireAuth, requireRole("provider"), async (req, res) => {
  try {
    const status = req.query.status;
    const filter = { providerId: req.user.id };
    if (status) filter.status = status;

    const bookings = await Booking.find(filter)
      .sort({ date: 1, createdAt: -1 })
      .populate("serviceId", "title price")
      .populate("userId", "name email")
      .populate("providerId", "name email");

    return res.json(bookings);
  } catch (err) {
    console.error("GET /providers/me/bookings error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * (Optional) provider stats endpoint
 * GET /api/providers/me/stats
 */
router.get("/me/stats", requireAuth, requireRole("provider"), async (req, res) => {
  try {
    const servicesCountPromise = Service.countDocuments({ providerId: req.user.id });
    const upcomingBookingsPromise = Booking.countDocuments({ providerId: req.user.id, status: "pending" });

    const [servicesCount, upcomingBookings] = await Promise.all([servicesCountPromise, upcomingBookingsPromise]);

    return res.json({ servicesCount, upcomingBookings });
  } catch (err) {
    console.error("GET /providers/me/stats error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
