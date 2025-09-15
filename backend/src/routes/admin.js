import express from "express";
import User from "../models/User.model.js";
import Service from "../models/Service.model.js";
import Booking from "../models/Booking.model.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import mongoose from "mongoose";
import Payment from "../models/Payment.js";
const router = express.Router();

// Protect all admin routes
router.use(requireAuth, requireRole("admin"));

/**
 * GET /api/admin/stats
 * Returns basic counts + bookings by day (last 30 days) and revenue info
 */
router.get("/stats", async (req, res) => {
  try {
    const now = new Date();
    const start = new Date(now);
    start.setDate(start.getDate() - 29); // last 30 days inclusive (today and 29 previous)

    const usersCount = await User.countDocuments({});
    const providersCount = await User.countDocuments({ role: "provider" });
    const servicesCount = await Service.countDocuments({});
    const bookingsCount = await Booking.countDocuments({});

    // --- bookings by day (last 30 days) ---
    const bookingsByDay = await Booking.aggregate([
      { $match: { date: { $gte: start } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Map bookingsByDay to an array covering every date in range (fills zeroes)
    const days = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      days.push(key);
    }
    const bookingsMap = Object.fromEntries((bookingsByDay || []).map((r) => [r._id, r.count]));
    const bookingsSeries = days.map((day) => ({ day, count: bookingsMap[day] || 0 }));

    // --- revenue by day (paid payments only) ---
    // NOTE: Payment.amount assumed to be stored in paise (integer). Adjust if you store rupees.
    const revenueByDayAgg = await Payment.aggregate([
      { $match: { status: "paid", createdAt: { $gte: start } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          totalPaise: { $sum: "$amount" }
        }
      },
      { $sort: { _id: 1 } }
    ]);
    const revenueMap = Object.fromEntries((revenueByDayAgg || []).map(r => [r._id, r.totalPaise]));
    const revenueSeries = days.map(day => ({ day, amountPaise: revenueMap[day] || 0 }));

    // --- payments totals and counts ---
    const paymentsTotalAgg = await Payment.aggregate([
      { $match: { status: "paid" } },
      { $group: { _id: null, totalPaise: { $sum: "$amount" }, count: { $sum: 1 } } }
    ]);
    const totalPaidPaise = paymentsTotalAgg?.[0]?.totalPaise ?? 0;
    const paidPaymentsCount = paymentsTotalAgg?.[0]?.count ?? 0;
    const pendingPaymentsCount = await Payment.countDocuments({ status: { $ne: "paid" } });

    // --- top earning providers (all-time) ---
    const topProvidersAgg = await Payment.aggregate([
      { $match: { status: "paid" } },
      { $group: { _id: "$providerId", totalPaise: { $sum: "$amount" } } },
      { $sort: { totalPaise: -1 } },
      { $limit: 8 },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "provider"
        }
      },
      { $unwind: { path: "$provider", preserveNullAndEmptyArrays: true } },
      { $project: { providerId: "$_id", providerName: "$provider.name", totalPaise: 1 } }
    ]);

    // role breakdown
    const userRoles = [
      { role: "user", count: await User.countDocuments({ role: "user" }) },
      { role: "provider", count: providersCount },
      { role: "admin", count: await User.countDocuments({ role: "admin" }) }
    ];

    res.json({
      usersCount,
      providersCount,
      servicesCount,
      bookingsCount,
      bookingsSeries,
      userRoles,

      // money fields
      totalRevenuePaise: totalPaidPaise,
      totalRevenue: totalPaidPaise / 100, // rupees
      paidPaymentsCount,
      pendingPaymentsCount,
      revenueSeries, // [{day, amountPaise}]
      topProviders: topProvidersAgg
    });
  } catch (err) {
    console.error("GET /api/admin/stats error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/admin/users
 * Query params: ?q=search ?role=provider/user/admin ?page & ?limit
 */
router.get("/users", async (req, res) => {
  try {
    const q = req.query.q?.trim();
    const role = req.query.role;
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 200);

    const filter = {};
    if (role) filter.role = role;
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ name: re }, { email: re }];
    }

    const total = await User.countDocuments(filter);
    const items = await User.find(filter)
      .select("-passwordHash")
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) || 1 });
  } catch (err) {
    console.error("GET /api/admin/users error:", err);
    res.status(500).json({ error: "Server error" });
  }
});
// GET /api/admin/payments?limit=20
router.get("/payments", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit || "20", 10), 200);
    const items = await Payment.find({})
      .populate("userId", "name email")
      .populate("providerId", "name email")
      .populate("bookingId", "serviceId date")
      .sort({ createdAt: -1 })
      .limit(limit);
    res.json({ items });
  } catch (err) {
    console.error("GET /api/admin/payments error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * PUT /api/admin/users/:id/verify
 * Approve (verify) a provider account
 */
router.put("/users/:id/verify", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid id" });

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (typeof req.body.isVerified === "boolean") {
        user.isVerified = req.body.isVerified;
    } else {
        user.isVerified = true; // default when admin just hits Verify
    }
    await user.save();
    res.json({ message: "User updated", user: { id: user._id, name: user.name, role: user.role, isVerified: user.isVerified } });
  } catch (err) {
    console.error("PUT /api/admin/users/:id/verify error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * DELETE /api/admin/users/:id
 */
router.delete("/users/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid id" });

    await User.findByIdAndDelete(id);
    res.json({ message: "User deleted" });
  } catch (err) {
    console.error("DELETE /api/admin/users/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/admin/services
 * List services (with pagination/search)
 */
router.get("/services", async (req, res) => {
  try {
    const q = req.query.q?.trim();
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 200);

    const filter = {};
    if (q) {
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      filter.$or = [{ title: re }, { description: re }, { category: re }];
    }

    const total = await Service.countDocuments(filter);
    const items = await Service.find(filter)
      .populate("providerId", "name email")
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });

    res.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) || 1 });
  } catch (err) {
    console.error("GET /api/admin/services error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * DELETE /api/admin/services/:id
 */
router.delete("/services/:id", async (req, res) => {
  try {
    const id = req.params.id;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid id" });
    await Service.findByIdAndDelete(id);
    res.json({ message: "Service deleted" });
  } catch (err) {
    console.error("DELETE /api/admin/services/:id error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/admin/bookings
 * List bookings (all) with optional status/filter
 */
router.get("/bookings", async (req, res) => {
  try {
    const status = req.query.status;
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 200);

    const filter = {};
    if (status) filter.status = status;

    const total = await Booking.countDocuments(filter);
    const items = await Booking.find(filter)
      .populate("serviceId", "title providerId")
      .populate("userId", "name email")
      .populate("providerId", "name email")
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ date: 1, createdAt: -1 });

    res.json({ items, total, page, limit, totalPages: Math.ceil(total / limit) || 1 });
  } catch (err) {
    console.error("GET /api/admin/bookings error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * PUT /api/admin/bookings/:id/status
 * Admin override booking status
 */
router.put("/bookings/:id/status", async (req, res) => {
  try {
    const id = req.params.id;
    const newStatus = req.body.status;
    if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ error: "Invalid id" });
    if (!newStatus) return res.status(400).json({ error: "Missing status" });

    const booking = await Booking.findById(id);
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    booking.status = newStatus;
    await booking.save();

    res.json(booking);
  } catch (err) {
    console.error("PUT /api/admin/bookings/:id/status error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
