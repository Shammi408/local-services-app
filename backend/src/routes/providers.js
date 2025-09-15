// routes/providers.js
import express from "express";
import mongoose from "mongoose";
import Booking from "../models/Booking.model.js";
import Service from "../models/Service.model.js";
import Payment from "../models/Payment.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = express.Router();

/**
 * GET /api/providers/me/services
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
 */
router.get("/me/bookings", requireAuth, requireRole("provider"), async (req, res) => {
  try {
    const status = req.query.status;
    const filter = { providerId: req.user.id };
    if (status) filter.status = status;

    const bookings = await Booking.find(filter)
      .sort({ createdAt: -1 })
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
 * GET /api/providers/me/stats
 */
router.get("/me/stats", requireAuth, requireRole("provider"), async (req, res) => {
  try {
    const providerId = new mongoose.Types.ObjectId(req.user.id);
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 29); // last 30 days

    // counts
    const servicesCountPromise = Service.countDocuments({ providerId });
    const bookingsCountPromise = Booking.countDocuments({ providerId });

    // bookings by day
    const bookingsByDay = await Booking.aggregate([
      { $match: { providerId, createdAt: { $gte: start } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);

    const days = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d.toISOString().slice(0, 10));
    }
    const bookingsMap = Object.fromEntries((bookingsByDay || []).map(r => [r._id, r.count]));
    const bookingsSeries = days.map(day => ({ day, count: bookingsMap[day] || 0 }));

    // revenue by day
    const revenueByDayAgg = await Payment.aggregate([
      { $match: { providerId, status: "paid", createdAt: { $gte: start } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, totalPaise: { $sum: "$amount" } } },
      { $sort: { _id: 1 } }
    ]);
    const revenueMap = Object.fromEntries((revenueByDayAgg || []).map(r => [r._id, r.totalPaise]));
    const revenueSeries = days.map(day => ({ day, amountPaise: revenueMap[day] || 0 }));

    // total earnings
    const totalAgg = await Payment.aggregate([
      { $match: { providerId, status: "paid" } },
      { $group: { _id: null, totalPaise: { $sum: "$amount" } } }
    ]);
    const totalPaise = totalAgg?.[0]?.totalPaise ?? 0;

    // recent bookings
    const recentBookings = await Booking.find({ providerId })
      .populate("userId", "name email")
      .populate("serviceId", "title price")
      .sort({ createdAt: -1 })
      .limit(8);

    const [servicesCount, bookingsCount] = await Promise.all([
      servicesCountPromise,
      bookingsCountPromise
    ]);

    res.json({
      servicesCount,
      bookingsCount,
      bookingsSeries,
      revenueSeries,
      totalEarningsPaise: totalPaise,
      totalEarnings: totalPaise / 100,
      recentBookings
    });
  } catch (err) {
    console.error("GET /providers/me/stats error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

export default router;
