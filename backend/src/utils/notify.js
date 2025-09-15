// src/utils/notify.js
import Notification from "../models/Notification.js";
import User from "../models/User.model.js";
import Subscription from "../models/Subscription.model.js";
import * as webpush from "./webpush.js"; // exports sendWebPush(subscription, payload) and getVapidPublicKey()
import nodemailer from "nodemailer";
import twilio from "twilio";

const {
  EMAIL_HOST,
  EMAIL_PORT,
  EMAIL_USER,
  EMAIL_PASS,
  TWILIO_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_PHONE_FROM,
  WEBAPP_URL
} = process.env;

const transporter = EMAIL_HOST && EMAIL_USER ? nodemailer.createTransport({
  host: EMAIL_HOST,
  port: Number(EMAIL_PORT) || 587,
  secure: Number(EMAIL_PORT) === 465,
  auth: {
    user: EMAIL_USER,
    pass: EMAIL_PASS
  }
}) : null;

const twilioClient = (TWILIO_SID && TWILIO_AUTH_TOKEN) ? twilio(TWILIO_SID, TWILIO_AUTH_TOKEN) : null;

function buildEmailHTML({ title, message, link }) {
  return `
    <div style="font-family: Arial, sans-serif; line-height:1.4; color:#111;">
      <h3>${title}</h3>
      <p>${message}</p>
      ${link ? `<p><a href="${link}">View details</a></p>` : ""}
      <hr/>
      <p style="font-size:12px;color:#777">Sent by ${WEBAPP_URL || "your app"}</p>
    </div>
  `;
}

/**
 * createNotification(options)
 * options: {
 *   userId, title, message, type, payload,
 *   sendPush = true, sendEmail = true, sendSMS = true, senderId = null
 * }
 * Returns saved Notification doc.
 */
export async function createNotification(options = {}) {
  const {
    userId,
    title = "Notification",
    message = "",
    type = "generic",
    payload = {},
    sendPush = true,
    sendEmail = true,
    sendSMS = true,
    senderId = null
  } = options;

  if (!userId) throw new Error("userId required for createNotification");

  const user = await User.findById(userId).lean();
  if (!user) throw new Error("User not found");

  // Build notification document fields
  const notifDoc = {
    userId,
    type,
    payload: { ...payload, title, message },
    isRead: false
  };
  // add senderId only if provided (keep schema tidy)
  if (senderId) notifDoc.senderId = senderId;

  // Save to DB
  const notif = new Notification(notifDoc);
  await notif.save();

  // Web Push
  if (sendPush) {
    try {
      const subs = await Subscription.find({ userId: user._id }).lean();
      for (const s of subs) {
        try {
          await webpush.sendWebPush({ endpoint: s.endpoint, keys: s.keys }, {
            title,
            body: message,
            data: { ...payload, notificationId: notif._id, type }
          });
        } catch (err) {
          console.warn("webpush send error for subscription", s._id, err?.message || err);
          const status = err && err.statusCode;
          if (status === 410 || status === 404) {
            try { await Subscription.deleteOne({ _id: s._id }); } catch (e) { /* ignore */ }
          }
        }
      }
    } catch (err) {
      console.warn("createNotification:webpush overall error", err?.message || err);
    }
  }

  // Email
  if (sendEmail && transporter && user.email) {
    try {
      await transporter.sendMail({
        from: EMAIL_USER,
        to: user.email,
        subject: title,
        html: buildEmailHTML({ title, message, link: payload?.link || `${WEBAPP_URL || ""}/notifications` })
      });
    } catch (err) {
      console.warn("Failed to send email notification", err?.message || err);
    }
  }

  // SMS via Twilio
  if (sendSMS && twilioClient && user.phone) {
    try {
      await twilioClient.messages.create({
        body: `${title} - ${message}`,
        from: TWILIO_PHONE_FROM,
        to: user.phone
      });
    } catch (err) {
      console.warn("Failed to send SMS", err?.message || err);
    }
  }

  return notif;
}

/**
 * convenience wrapper used by booking route
 */
export async function notifyUserBookingCreated({ savedBooking, serviceTitle }) {
  try {
    const customerId = savedBooking.userId;
    const providerId = savedBooking.providerId;

    await createNotification({
      userId: customerId,
      title: "Booking created",
      message: `Your booking for ${serviceTitle || "service"} has been created.`,
      type: "booking.created",
      payload: { bookingId: savedBooking._id, link: `/bookings/${savedBooking._id}` },
      sendPush: true,
      sendEmail: true,
      sendSMS: true
    });

    await createNotification({
      userId: providerId,
      title: "New booking received",
      message: `You have a new booking for ${serviceTitle || "service"}.`,
      type: "booking.received",
      payload: { bookingId: savedBooking._id, link: `/provider/bookings/${savedBooking._id}` },
      sendPush: true,
      sendEmail: true,
      sendSMS: true
    });
  } catch (err) {
    console.warn("notifyUserBookingCreated failed", err?.message || err);
  }
}

export async function notifyUserNewMessage({ recipientId, senderName, text, conversationId, messageId, senderId = null }) {
  try {
    const snippet = text
      ? (text.length > 120 ? text.slice(0, 117) + "…" : text)
      : "You received a new message";

    const notif = await createNotification({
      userId: recipientId,
      title: `New message from ${senderName || "Someone"}`,
      message: snippet,
      type: "chat.message",
      payload: {
        conversationId,
        messageId,
        link: `/chats/${conversationId}`
      },
      sendPush: true,
      sendEmail: false,
      sendSMS: false,
      senderId: senderId || null
    });

    return notif;
  } catch (err) {
    console.warn("notifyUserNewMessage failed", err?.message || err);
    return null;
  }
}

export default { createNotification, notifyUserBookingCreated, notifyUserNewMessage };
