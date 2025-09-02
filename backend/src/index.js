import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import authRoutes from "./routes/auth.routes.js";



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

// Health Check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", message: "Server is healthy ✅" });
});

export default app;
