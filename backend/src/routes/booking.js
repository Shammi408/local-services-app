// routes/booking.js
import express from "express";
import mongoose from "mongoose";
import Booking from "../models/Booking.model.js";
import Service from "../models/Service.model.js";
import Review from "../models/Review.model.js";
import { requireAuth } from "../middleware/auth.js";
import { createNotification } from "../utils/notify.js";

/**
 * Factory that creates and returns the bookings router bound to a socket.io instance.
 * Usage in index.js: app.use("/api/bookings", createBookingsRouter(io));
 */
export default function createBookingsRouter(io) {
  const router = express.Router();

  /**
   * POST /api/bookings
   */
  router.post("/", requireAuth, async (req, res) => {
    try {
      const { serviceId, date } = req.body;

      const service = await Service.findById(serviceId);
      if (!service) return res.status(404).json({ error: "Service not found" });

      const selected = new Date(date);
      if (isNaN(selected.getTime())) return res.status(400).json({ error: "Invalid date" });
      if (selected <= new Date()) return res.status(400).json({ error: "Date must be in the future" });

      const newBooking = new Booking({
        userId: req.user.id,
        providerId: service.providerId,
        serviceId: service._id,
        date
      });

      const savedBooking = await newBooking.save();

      // respond immediately
      res.status(201).json(savedBooking);

      // emit socket events (best-effort)
      try {
        const customerId = String(savedBooking.userId);
        const providerId = String(savedBooking.providerId);
        const payload = savedBooking.toObject ? savedBooking.toObject() : JSON.parse(JSON.stringify(savedBooking));

        if (io) {
          try {
            io.to(providerId).emit("booking.created", payload);
            io.to(customerId).emit("booking.created", payload);
            // optional admin channel: io.to("admins").emit("booking.created", payload);
          } catch (socketErr) {
            console.warn("Socket emit failed (booking.created):", socketErr?.message || socketErr);
          }
        }
      } catch (e) {
        console.warn("Socket notify (create) error:", e?.message || e);
      }

      // best-effort background notifications (async)
      (async () => {
        try {
          const customerId = String(savedBooking.userId);
          const providerId = String(savedBooking.providerId);

          // notify customer
          try {
            await createNotification({
              userId: customerId,
              title: "Booking created",
              message: `Your booking for ${service?.title || "service"} has been created.`,
              type: "booking.created",
              payload: { bookingId: savedBooking._id, link: `/bookings/${savedBooking._id}` },
              sendPush: true,
              sendEmail: true,
              sendSMS: true
            });
          } catch (e) {
            console.warn("notify customer failed:", e?.message || e);
          }

          // notify provider
          try {
            await createNotification({
              userId: providerId,
              title: "New booking received",
              message: `You have a new booking for ${service?.title || "service"}.`,
              type: "booking.received",
              payload: { bookingId: savedBooking._id, link: `/provider/bookings/${savedBooking._id}` },
              sendPush: true,
              sendEmail: true,
              sendSMS: true
            });
          } catch (e) {
            console.warn("notify provider failed:", e?.message || e);
          }
        } catch (bgErr) {
          console.warn("Background notification error (bookings):", bgErr?.message || bgErr);
        }
      })();
    } catch (err) {
      console.error("POST /bookings error:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  /**
   * GET /api/bookings
   * - role-based (user/provider)
   * - optional filters: ?status=, ?serviceId=
   * - pagination: ?page & ?limit
   * - attaches hasReviewed boolean
   */
  router.get("/", requireAuth, async (req, res) => {
    try {
      let filter = {};
      if (req.user.role === "user") filter.userId = req.user.id;
      else if (req.user.role === "provider") filter.providerId = req.user.id;

      const status = (req.query.status || "").toString().trim().toLowerCase();
      if (status) {
        if (status === "upcoming") {
          const now = new Date();
          filter.status = { $in: ["pending", "confirmed"] };
          filter.date = { $gte: now };
        } else {
          filter.status = status;
        }
      }

      if (req.query.serviceId) filter.serviceId = req.query.serviceId;

      const page = Math.max(parseInt(req.query.page || "1", 10), 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit || "50", 10), 1), 200);

      const bookings = await Booking.find(filter)
        .sort({ date: 1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("serviceId", "title price providerId")
        .populate("userId", "name email")
        .populate("providerId", "name email");

      const serviceIds = bookings
        .map((b) => b.serviceId?._id ?? b.serviceId)
        .filter(Boolean)
        .map((s) => String(s));

      if (serviceIds.length === 0) {
        const plain = bookings.map((b) => {
          const obj = b.toObject ? b.toObject() : JSON.parse(JSON.stringify(b));
          obj.hasReviewed = false;
          return obj;
        });
        return res.json(plain);
      }

      const uniqueServiceIds = [...new Set(serviceIds)].map(
        (id) => new mongoose.Types.ObjectId(id)
      );

      const userReviews = await Review.find({
        serviceId: { $in: uniqueServiceIds },
        userId: new mongoose.Types.ObjectId(req.user.id)
      })
        .select("serviceId")
        .lean();

      const reviewedSet = new Set((userReviews || []).map((r) => String(r.serviceId)));

      const enhanced = bookings.map((b) => {
        const obj = b.toObject ? b.toObject() : JSON.parse(JSON.stringify(b));
        const sid = obj.serviceId?._id ?? obj.serviceId;
        obj.hasReviewed = !!sid && reviewedSet.has(String(sid));
        return obj;
      });

      res.json(enhanced);
    } catch (err) {
      console.error("GET /bookings error:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  /**
   * PUT /api/bookings/:id
   */
  router.put("/:id", requireAuth, async (req, res) => {
    try {
      const { status } = req.body;
      const booking = await Booking.findById(req.params.id);
      if (!booking) return res.status(404).json({ error: "Booking not found" });

      if (
        req.user.role === "provider" &&
        booking.providerId.toString() === req.user.id
      ) {
        booking.status = status;
      } else if (
        req.user.role === "user" &&
        booking.userId.toString() === req.user.id &&
        status === "cancelled"
      ) {
        booking.status = "cancelled";
      } else {
        return res.status(403).json({ error: "Not allowed to update booking" });
      }

      const updatedBooking = await booking.save();
      res.json(updatedBooking);

      // emit socket update (best-effort)
      try {
        const payload = updatedBooking.toObject ? updatedBooking.toObject() : JSON.parse(JSON.stringify(updatedBooking));
        const customerId = String(updatedBooking.userId);
        const providerId = String(updatedBooking.providerId);

        if (io) {
          try {
            io.to(customerId).emit("booking.updated", payload);
            io.to(providerId).emit("booking.updated", payload);
            // io.to("admins").emit("booking.updated", payload); // optional
          } catch (socketErr) {
            console.warn("Socket emit failed (booking.updated):", socketErr?.message || socketErr);
          }
        }
      } catch (e) {
        console.warn("Socket notify (update) error:", e?.message || e);
      }

      // best-effort notifications
      try {
        const service = await Service.findById(updatedBooking.serviceId)
          .select("title")
          .lean();

        await createNotification({
          userId: updatedBooking.userId,
          title: `Booking ${updatedBooking.status}`,
          message: `Your booking for ${service?.title || "service"} is now ${updatedBooking.status}.`,
          type: "booking.status",
          payload: {
            bookingId: updatedBooking._id,
            status: updatedBooking.status,
            serviceTitle: service?.title
          },
          sendPush: true,
          sendEmail: true,
          sendSMS: true
        });

        await createNotification({
          userId: updatedBooking.providerId,
          title: `Booking ${updatedBooking.status}`,
          message: `Booking ${updatedBooking._id} status changed to ${updatedBooking.status}.`,
          type: "booking.status.provider",
          payload: { bookingId: updatedBooking._id, status: updatedBooking.status },
          sendPush: true,
          sendEmail: true,
          sendSMS: false
        });
      } catch (e) {
        console.warn("Failed to notify about booking.status:", e?.message || e);
      }
    } catch (err) {
      console.error("PUT /bookings/:id error:", err);
      res.status(500).json({ error: "Booking update failed" });
    }
  });

  return router;
}
