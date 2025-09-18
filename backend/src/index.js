// index.js
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import path from "path";

import authRoutes from "./routes/auth.routes.js";
import profileRoutes from "./routes/profile.js";
import serviceRoutes from "./routes/service.js";
import reviewRoutes from "./routes/review.js";
import createChatRouter from "./routes/chat.js";   
import notificationRouter from "./routes/notification.js";
import paymentRoutes from "./routes/payment.js";
import providerRoutes from "./routes/providers.js";
import adminRoutes from "./routes/admin.js";
import uploadsRouter from "./routes/uploads.js";
import createBookingsRouter from "./routes/booking.js";

import http from "http";
import { Server } from "socket.io";
import supportRoutes from "./routes/support.js";
import { verifyAccessToken } from "./utils/jwt.js";

dotenv.config();
connectDB();

const app = express();
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
// Middlewares
app.use(helmet());
app.use(cors({
  origin: (origin, cb) => {
    // allow no-origin requests like Postman or server-to-server
    if (!origin || origin === FRONTEND_URL) return cb(null, true);
    // allow the FRONTEND_URL; change this to be stricter in prod
    return cb(null, true);
  },
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());
app.use(morgan("dev"));

// HTTP + Socket.io
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: FRONTEND_URL, methods: ["GET", "POST"], credentials: true },
});

// socket logic
io.use((socket, next) => {
  try {
    const token = socket.handshake.auth?.token || null;
    if (!token) {
      // if you want to allow unauthenticated connections, call next(); otherwise:
      return next(new Error("Authentication required"));
    }
    const payload = verifyAccessToken(token); // will throw if invalid/expired
    if (!payload?.sub) return next(new Error("Invalid token payload"));
    socket.userId = String(payload.sub);
    return next();
  } catch (err) {
    console.warn("Socket auth failed:", err?.message || err);
    return next(new Error("Authentication failed"));
  }
});

// connection handler (run after io.use above)
io.on("connection", (socket) => {
  console.log("🔌 User connected:", socket.id, "userId:", socket.userId || "(none)");
  // auto-join the user's personal room if we have userId from token
  if (socket.userId) {
    socket.join(socket.userId);
    console.log(`✅ Socket ${socket.id} joined room ${socket.userId}`);
  }
  // safe join: client may still emit 'join', but server verifies it matches socket.userId
  socket.on("join", (userId) => {
    if (!socket.userId) return; // unauthenticated socket cannot join rooms
    if (String(userId) === String(socket.userId)) {
      socket.join(String(userId));
      console.log(`✅ Socket ${socket.id} (user ${socket.userId}) joined room ${userId}`);
    } else {
      console.warn(`Socket ${socket.id} attempted to join room ${userId} but token userId=${socket.userId}`);
      // optionally disconnect or ignore
    }
  });
  // your other handlers remain the same...
  socket.on("sendMessage", (msg) => {
    const { recipientId } = msg;
    io.to(recipientId).emit("receiveMessage", msg);
    console.log("📩 message relayed", msg);
  });
  socket.on("disconnect", () => {
    console.log("❌ User disconnected:", socket.id);
  });
});
// Routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/chat", createChatRouter(io));   
app.use("/api/notifications", notificationRouter);
app.use("/api/payments", paymentRoutes);
app.use("/api/providers", providerRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/uploads", uploadsRouter);
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use("/api/support", supportRoutes);
app.use("/api/bookings", createBookingsRouter(io));
// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Server is healthy ✅" });
});

// 👉 Export server for server.js
export { app, server };
