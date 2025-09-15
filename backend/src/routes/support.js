// src/routes/support.js
import express from "express";
import Support from "../models/Support.model.js";
import nodemailer from "nodemailer";

const router = express.Router();

// read SMTP config from env
const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  FROM_EMAIL,
  ADMIN_EMAIL
} = process.env;

// create nodemailer transport only if SMTP config present
let transporter = null;
if (SMTP_HOST && SMTP_USER) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT ? Number(SMTP_PORT) : 587,
    secure: (SMTP_SECURE === "true" || SMTP_SECURE === "1") || false,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
  // optional verify during startup (will log but not throw)
  transporter.verify().then(() => {
    console.log("Support email transporter ready");
  }).catch(err => {
    console.warn("Support email transporter verify failed:", err?.message || err);
  });
} else {
  console.warn("SMTP not configured. Support emails will not be sent.");
}

/**
 * POST /api/support/contact
 * Public endpoint to submit contact/support messages.
 * Body: { name, email, subject, message }
 */
router.post("/contact", async (req, res) => {
  try {
    const { name, email, subject, message } = req.body || {};

    if (!name || !email || !subject || !message) {
      return res.status(400).json({ error: "name, email, subject and message are required" });
    }

    // cooldown: prevent same email from submitting within last hour
    try {
      const last = await Support.findOne({ email: String(email).trim().toLowerCase() })
        .sort({ createdAt: -1 })
        .lean();
      if (last) {
        const oneHourMs = 60 * 60 * 1000;
        const age = Date.now() - new Date(last.createdAt).getTime();
        if (age < oneHourMs) {
          const minutes = Math.ceil((oneHourMs - age) / 60000);
          return res.status(429).json({ error: `Please wait ${minutes} minute(s) before sending another message.` });
        }
      }
    } catch (e) {
      // ignore cooldown check failures, continue
      console.warn("Cooldown check failed:", e);
    }

    const doc = new Support({
      name: String(name).trim().slice(0, 200),
      email: String(email).trim().slice(0, 200),
      subject: String(subject).trim().slice(0, 200),
      message: String(message).trim().slice(0, 5000)
    });

    await doc.save();

    // If transporter is configured, send emails (admin notification + autoresponse)
    if (transporter) {
      // admin notification HTML
      const adminHtml = `
        <h2>New contact message from LocalServe</h2>
        <p><strong>From:</strong> ${escapeHtml(doc.name)} &lt;${escapeHtml(doc.email)}&gt;</p>
        <p><strong>Subject:</strong> ${escapeHtml(doc.subject)}</p>
        <p><strong>Received:</strong> ${new Date(doc.createdAt).toLocaleString()}</p>
        <hr/>
        <p><strong>Message:</strong></p>
        <div style="white-space:pre-wrap;">${escapeHtml(doc.message)}</div>
        <p style="margin-top:1rem;color:#666;font-size:12px;">Support ID: ${doc._id}</p>
      `;

      // user autoresponse HTML
      const userHtml = `
        <p>Hi ${escapeHtml(doc.name)},</p>
        <p>Thanks for contacting LocalServe. We've received your message and our support team will get back to you within 24 hours.</p>
        <p><strong>Your message:</strong></p>
        <div style="white-space:pre-wrap;">${escapeHtml(doc.message)}</div>
        <p style="margin-top:12px">Support reference: <strong>${doc._id}</strong></p>
        <p>Best,<br/>LocalServe Support Team</p>
      `;

      // send admin email
      transporter.sendMail({
        from: FROM_EMAIL || (SMTP_USER || 'no-reply@example.com'),
        to: ADMIN_EMAIL || 'shubhendushekhar408@gmail.com',
        subject: `[LocalServe] Contact: ${doc.subject}`,
        html: adminHtml,
        replyTo: doc.email
      }).catch(err => {
        console.error("Failed to send admin notification email:", err?.message || err);
      });

      // send autoresponse to user (optional)
      transporter.sendMail({
        from: FROM_EMAIL || (SMTP_USER || 'no-reply@example.com'),
        to: doc.email,
        subject: `We received your message — LocalServe`,
        html: userHtml,
      }).catch(err => {
        console.error("Failed to send autoresponse email:", err?.message || err);
      });
    } else {
      console.log("SMTP not configured — skipping email sends for support message", doc._id);
    }

    // success response
    res.status(201).json({ message: "Message received", id: doc._id });
  } catch (err) {
    console.error("POST /support/contact error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;

/**
 * simple helper to escape HTML – prevents injection in templates
 */
function escapeHtml(str = "") {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
