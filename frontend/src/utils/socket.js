// src/utils/socket.js
import { io } from "socket.io-client";
import { showToast } from "./toast";
import { useBookingsStore } from "../stores/bookings";

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3000";

const socket = io(SOCKET_URL, {
  autoConnect: false,
  transports: ["websocket", "polling"],
  auth: { token: localStorage.getItem("token") || null }
});

// call this after user logs in or on app mount if token exists
export function joinSocket(userId) {
  if (!userId) return;
  // refresh token in case it changed
  socket.auth = { token: localStorage.getItem("token") || null };
  if (!socket.connected) socket.connect();
  // join room accepted by server (server verifies token)
  socket.emit("join", userId);
}

// call this on logout
export function leaveSocket(userId) {
  try {
    if (socket.connected) {
      socket.emit("leave", userId); // optional: server may ignore
      socket.disconnect();
    }
  } catch (e) {
    console.warn("leaveSocket error:", e?.message || e);
  }
}

/**
 * Attach listeners for booking events and general notifications.
 * - store (Pinia store) is optional — if present we'll call addOrUpdateBooking.
 * - options callbacks are optional.
 */
export function setupSocketListeners(store = null, options = {}) {
  const bookingsStore = store || useBookingsStore();
  const { onBookingCreated, onBookingUpdated, onConnect, onDisconnect } = options;

  // connect/disconnect
  socket.off("connect").on("connect", () => {
    // console.log("Socket connected:", socket.id);
    if (typeof onConnect === "function") onConnect(socket);
  });

  socket.off("disconnect").on("disconnect", (reason) => {
    // console.log("Socket disconnected:", reason);
    if (typeof onDisconnect === "function") onDisconnect(reason);
  });

  // Booking created
  socket.off("booking.created").on("booking.created", (booking) => {
    try {
      // console.log("socket event booking.created", booking);
      // update store (if method exists)
      if (bookingsStore && typeof bookingsStore.addOrUpdateBooking === "function") {
        bookingsStore.addOrUpdateBooking(booking);
      }
      // show in-app toast
      const title = `New booking${booking._id ? ` #${String(booking._id).slice(-6)}` : ""}`;
      const text = `Booking for ${booking?.serviceId?.title ?? "service"} on ${new Date(booking.date).toLocaleString()}`;
      showToast(`${title}: ${text}`, { type: "success" });

      // optional callback
      if (typeof onBookingCreated === "function") onBookingCreated(booking);

      // Native Notification if permission
      if ("Notification" in window) {
        if (Notification.permission === "granted") {
          new Notification(title, { body: text, tag: `booking-${booking._id}` });
        } else if (Notification.permission !== "denied") {
          Notification.requestPermission().then((perm) => {
            if (perm === "granted") {
              new Notification(title, { body: text, tag: `booking-${booking._id}` });
            }
          });
        }
      }
    } catch (e) {
      console.warn("Error handling booking.created:", e);
    }
  });

  // Booking updated
  socket.off("booking.updated").on("booking.updated", (booking) => {
    try {
      console.log("socket event booking.updated", booking);
      if (bookingsStore && typeof bookingsStore.addOrUpdateBooking === "function") {
        bookingsStore.addOrUpdateBooking(booking);
      }
      const title = `Booking ${booking.status}`;
      const text = `Booking for ${booking?.serviceId?.title ?? "service"} is now ${booking.status}`;
      showToast(`${title}: ${text}`, { type: "info" });

      if (typeof onBookingUpdated === "function") onBookingUpdated(booking);

      if ("Notification" in window) {
        if (Notification.permission === "granted") {
          new Notification(title, { body: text, tag: `booking-${booking._id}` });
        }
      }
    } catch (e) {
      console.warn("Error handling booking.updated:", e);
    }
  });

  // generic server notifications (if you emit 'notification')
  socket.off("notification").on("notification", (payload) => {
    try {
      // optional: push to notifications store
      const title = payload?.title || "Notification";
      const body = payload?.message || JSON.stringify(payload);
      showToast(`${title}: ${body}`, { type: "info" });
      if ("Notification" in window && Notification.permission === "granted") {
        new Notification(title, { body, tag: `notif-${Date.now()}` });
      }
    } catch (e) {
      console.warn("Error handling notification event:", e);
    }
  });
}

export default socket;
