import express from "express";
import Payment from "../models/Payment.js";
import Booking from "../models/Booking.model.js";
import { requireAuth } from "../middleware/auth.js";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

/**
 * POST /api/payments/create-mock
 * Create a mock payment order for a booking (frontend calls this)
 */
router.post("/create-mock", requireAuth, async (req, res) => {
  try {
    const { bookingId, amount } = req.body;
    if (!bookingId || !amount) return res.status(400).json({ error: "bookingId and amount required" });

    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ error: "Booking not found" });

    const payment = new Payment({
      bookingId,
      userId: req.user.id,
      providerId: booking.providerId,
      amount,
      providerOrderId: `MOCK_${uuidv4()}`,
      status: "created"
    });

    await payment.save();

    // return order details that frontend would use to open checkout
    res.status(201).json({ paymentId: payment._id, orderId: payment.providerOrderId });
  } catch (err) {
    console.error("POST /payments/create-mock error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/payments/webhook-mock
 * Simulate gateway webhook (call from Postman). Body: { paymentId, status } status: 'paid'|'failed'
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
      // e.g., mark booking as confirmed or paid
      await Booking.findByIdAndUpdate(payment.bookingId, { status: "confirmed" });

      // create notification to provider & user (optional)
      // ...
    }

    res.json({ ok: true });
  } catch (err) {
    console.error("POST /payments/webhook-mock error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
