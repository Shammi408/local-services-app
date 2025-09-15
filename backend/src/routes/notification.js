// src/routes/notifications.js
import express from "express";
import Subscription from "../models/Subscription.model.js";
import Notification from "../models/Notification.js";
import { getVapidPublicKey, sendWebPush } from "../utils/webpush.js"; // your webpush exports
import { requireAuth } from "../middleware/auth.js";
import User from "../models/User.model.js";

const router = express.Router();

/**
 * GET /api/notifications/vapid
 * Public: returns VAPID public key for frontend to subscribe
 */
router.get("/vapid", (req, res) => {
  try {
    const key = getVapidPublicKey();
    res.json({ publicKey: key || null });
  } catch (err) {
    console.error("GET /notifications/vapid error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/notifications/subscribe
 * Body: { subscription }.
 * If request has Authorization (req.user via requireAuth middleware), that userId will be attached.
 * This endpoint is idempotent: upserts by endpoint.
 */
router.post("/subscribe", async (req, res) => {
  try {
    const subscription = req.body.subscription || req.body;
    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ error: "subscription object required" });
    }

    // Prefer authenticated user if present (you may have optional auth middleware that sets req.user)
    const uid = req.user?.id || req.body.userId || null;

    // Build doc fields to upsert
    const toUpsert = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys?.p256dh || (subscription.getKey ? subscription.getKey('p256dh') : undefined),
        auth: subscription.keys?.auth || (subscription.getKey ? subscription.getKey('auth') : undefined)
      }
    };
    if (uid) toUpsert.userId = uid;

    // Upsert strategy: if endpoint exists, update; else create
    const updated = await Subscription.findOneAndUpdate(
      { endpoint: toUpsert.endpoint },
      { $set: toUpsert, $setOnInsert: { createdAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    return res.status(200).json({ ok: true, id: updated._id });
  } catch (err) {
    console.error("POST /notifications/subscribe error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/notifications/unsubscribe
 * Body: { endpoint } - if endpoint provided, remove that subscription.
 * If authenticated but no endpoint provided, remove all subscriptions for this user (useful on logout).
 * If unauthenticated but client sent userId in body, remove by userId.
 */
router.post("/unsubscribe", async (req, res) => {
  try {
    const endpoint = req.body?.endpoint;
    if (endpoint) {
      await Subscription.deleteOne({ endpoint });
      return res.json({ ok: true });
    }

    // prefer authenticated user if available
    if (req.user && req.user.id) {
      await Subscription.deleteMany({ userId: req.user.id });
      return res.json({ ok: true, removedForUser: req.user.id });
    }

    // fallback: client may send userId in body (we accept it for attach/detach flows)
    const bodyUserId = req.body?.userId || null;
    if (bodyUserId) {
      await Subscription.deleteMany({ userId: bodyUserId });
      return res.json({ ok: true, removedForUser: bodyUserId });
    }

    return res.status(400).json({ error: "endpoint or authenticated user or userId required" });
  } catch (err) {
    console.error("POST /notifications/unsubscribe error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/notifications
 * Query: ?page=1&limit=20
 * Requires auth. Returns notifications for current user, sorted by newest first.
 */
router.get("/", requireAuth, async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit || "20", 10), 1), 200);

    const total = await Notification.countDocuments({ userId: req.user.id });
    const items = await Notification.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean();

    res.json({ total, page, limit, items });
  } catch (err) {
    console.error("GET /notifications error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/notifications/unread-count
 */
router.get("/unread-count", requireAuth, async (req, res) => {
  try {
    const count = await Notification.countDocuments({ userId: req.user.id, isRead: false });
    res.json({ unread: count });
  } catch (err) {
    console.error("GET /notifications/unread-count error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * PUT /api/notifications/:id/read
 * Marks a notification as read (isRead = true)
 */
router.put("/:id/read", requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const notif = await Notification.findOne({ _id: id, userId: req.user.id });
    if (!notif) return res.status(404).json({ error: "Notification not found" });
    notif.isRead = true;
    await notif.save();
    res.json({ ok: true, id: notif._id });
  } catch (err) {
    console.error("PUT /notifications/:id/read error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
