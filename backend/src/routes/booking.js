import express from "express";
import Booking from "../models/Booking.model.js";
import Service from "../models/Service.model.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

/**
 * @route   POST /api/bookings
 * @desc    Create a booking for a service
 * @access  Private (user must be logged in)
 */
router.post("/", requireAuth, async (req, res) => {
  try {
    const { serviceId, date } = req.body;

    // Find the service
    const service = await Service.findById(serviceId);
    if (!service) return res.status(404).json({ error: "Service not found" });

    const newBooking = new Booking({
      userId: req.user.id,
      providerId: service.providerId,
      serviceId: service._id,
      date
    });

    const savedBooking = await newBooking.save();
    res.status(201).json(savedBooking);
  } catch (err) {
    console.error("POST /bookings error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * @route   GET /api/bookings
 * @desc    Get bookings for logged-in user (user or provider)
 * @access  Private
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    let filter = {};

    if (req.user.role === "user") {
      filter.userId = req.user.id;
    } else if (req.user.role === "provider") {
      filter.providerId = req.user.id;
    }

    const bookings = await Booking.find(filter)
      .populate("serviceId", "title price")
      .populate("userId", "name email")
      .populate("providerId", "name email");

    res.json(bookings);
  } catch (err) {
    console.error("GET /bookings error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * @route   PUT /api/bookings/:id
 * @desc    Update booking status (confirm, cancel, complete)
 * @access  Private
 */
router.put("/:id", requireAuth, async (req, res) => {
  try {
    const { status } = req.body;

    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    // Only provider can confirm/complete/cancel bookings
    if (req.user.role === "provider" && booking.providerId.toString() === req.user.id) {
      booking.status = status;
    }
    // User can only cancel their own booking
    else if (req.user.role === "user" && booking.userId.toString() === req.user.id && status === "cancelled") {
      booking.status = "cancelled";
    } else {
      return res.status(403).json({ error: "Not allowed to update booking" });
    }

    const updatedBooking = await booking.save();
    res.json(updatedBooking);
  } catch (err) {
    console.error("PUT /bookings/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
