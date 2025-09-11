import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";
import profileRoutes from "./routes/profile.js";
import serviceRoutes from "./routes/service.js";
import bookingRoutes from "./routes/booking.js";
import reviewRoutes from "./routes/review.js";
import chatRoutes from "./routes/chat.js";
import notificationRoutes from "./routes/notification.js";
import paymentRoutes from "./routes/payment.js";
import providerRoutes from "./routes/providers.js";
import adminRoutes from "./routes/admin.js";


dotenv.config();
connectDB();

const app = express();

// Middlewares
app.use(helmet()); // security headers
app.use(cors({ origin: "http://localhost:5173", credentials: true })); // allow frontend
app.use(express.json()); // parse JSON requests
app.use(cookieParser()); // parse cookies
app.use(morgan("dev")); // log requests

//Routes
app.use("/api/auth", authRoutes);
app.use("/api/profile", profileRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/payments", paymentRoutes);
app.use("/api/providers", providerRoutes);
app.use("/api/admin", adminRoutes);
// app.use("/uploads", express.static(path.join(process.cwd(), "uploads"))); // serve files
// app.use("/api/uploads", uploadsRouter); // mount router

// Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Server is healthy ✅" });
});

export default app;
