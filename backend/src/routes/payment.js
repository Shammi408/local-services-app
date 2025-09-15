// src/routes/payment.js
import express from "express";
import Payment from "../models/Payment.js";
import Booking from "../models/Booking.model.js";
import { requireAuth } from "../middleware/auth.js";
import { v4 as uuidv4 } from "uuid";
import { createNotification } from "../utils/notify.js";
// lazy import Razorpay if available
let Razorpay = null;
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  try {
    Razorpay = (await import("razorpay")).default || (await import("razorpay"));
  } catch (e) {
    console.warn("Razorpay SDK not available, falling back to mock payment endpoints.");
    Razorpay = null;
  }
}

const router = express.Router();

router.post("/create", requireAuth, async (req, res) => {
  try {
    const { bookingId, amount } = req.body;
    if (!bookingId || amount === undefined) return res.status(400).json({ error: "bookingId and amount required" });

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    if (Razorpay && process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
      const razor = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
      });

      const amountPaise = Math.round(Number(amount) * 100);

      const payment = new Payment({
        bookingId,
        userId: req.user.id,
        providerId: booking.providerId,
        amount: amountPaise,
        providerOrderId: null,
        status: "created"
      });
      await payment.save();

      const orderOptions = {
        amount: amountPaise,
        currency: "INR",
        receipt: `rcpt_${payment._id}`,
        notes: { bookingId: bookingId.toString(), paymentId: payment._id.toString() }
      };

      const order = await razor.orders.create(orderOptions);

      payment.providerOrderId = order.id;
      await payment.save();

      return res.status(201).json({
        paymentId: payment._id,
        orderId: order.id,
        amount: amountPaise,
        currency: order.currency || "INR",
        keyId: process.env.RAZORPAY_KEY_ID
      });
    }

    // mock fallback
    const amountPaise = Math.round(Number(amount) * 100);
    const payment = new Payment({
      bookingId,
      userId: req.user.id,
      providerId: booking.providerId,
      amount: amountPaise,
      providerOrderId: `MOCK_${uuidv4()}`,
      status: "created"
    });
    await payment.save();

    res.status(201).json({
      paymentId: payment._id,
      orderId: payment.providerOrderId,
      amount: amountPaise,
      currency: "INR",
      keyId: process.env.MOCK_RAZORPAY_KEY_ID || process.env.RAZORPAY_KEY_ID || "rzp_test_mockkey"
    });
  } catch (err) {
    console.error("POST /payments/create error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/payments/verify
 * body: { paymentId, ...gateway fields }
 */
router.post("/verify", requireAuth, async (req, res) => {
  try {
    const { paymentId } = req.body;
    if (!paymentId) return res.status(400).json({ error: "paymentId required" });

    const payment = await Payment.findById(paymentId);
    if (!payment) return res.status(404).json({ error: "Payment not found" });

    // mark paid (for mock/dev). For real gateway verify signature here.
    payment.status = "paid";
    await payment.save();

    await Booking.findByIdAndUpdate(payment.bookingId, {
      status: "confirmed",
      paid: true,
      paymentId: payment._id
    });

    // notify customer
    try {
      await createNotification({
        userId: payment.userId,
        title: "Payment received",
        message: `Payment for booking ${payment.bookingId} received successfully.`,
        type: "payment.completed",
        payload: { bookingId: payment.bookingId, paymentId: payment._id, amount: payment.amount },
        sendPush: true,
        sendEmail: true,
        sendSMS: true
      });
    } catch (e) {
      console.warn("notify customer payment.completed failed", e?.message || e);
    }

    // notify provider
    try {
      await createNotification({
        userId: payment.providerId,
        title: "Booking paid",
        message: `Booking ${payment.bookingId} has been paid.`,
        type: "payment.provider",
        payload: { bookingId: payment.bookingId, paymentId: payment._id, amount: payment.amount },
        sendPush: true,
        sendEmail: true,
        sendSMS: false
      });
    } catch (e) {
      console.warn("notify provider payment.completed failed", e?.message || e);
    }

    res.json({ ok: true, paymentId: payment._id });
  } catch (err) {
    console.error("POST /payments/verify error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * webhook-mock to simulate gateway callbacks
 * body: { paymentId, status }
 */
router.post("/webhook-mock", async (req, res) => {
  try {
    const { paymentId, status } = req.body;
    if (!paymentId || !status) return res.status(400).json({ error: "paymentId and status required" });

    const payment = await Payment.findById(paymentId);
    if (!payment) return res.status(404).json({ error: "Payment not found" });

    payment.status = status;
    await payment.save();

    if (status === "paid") {
      await Booking.findByIdAndUpdate(payment.bookingId, {
        status: "confirmed",
        paid: true,
        paymentId: payment._id
      });

      try {
        await createNotification({
          userId: payment.userId,
          title: "Payment received",
          message: `Payment for booking ${payment.bookingId} has been received.`,
          type: "payment.completed",
          payload: { bookingId: payment.bookingId, paymentId: payment._id },
          sendPush: true,
          sendEmail: true,
          sendSMS: true
        });
      } catch (e) { console.warn("webhook-mock notify customer failed", e?.message || e); }

      try {
        await createNotification({
          userId: payment.providerId,
          title: "Booking paid",
          message: `Booking ${payment.bookingId} was paid.`,
          type: "payment.provider",
          payload: { bookingId: payment.bookingId, paymentId: payment._id },
          sendPush: true,
          sendEmail: true,
          sendSMS: false
        });
      } catch (e) { console.warn("webhook-mock notify provider failed", e?.message || e); }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("POST /payments/webhook-mock error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
