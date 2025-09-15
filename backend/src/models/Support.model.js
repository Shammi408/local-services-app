// src/models/Support.model.js
import mongoose from "mongoose";

const SupportSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, trim: true },
  subject: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  handled: { type: Boolean, default: false }, // useful for admin dashboard
  handledBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
}, { timestamps: true });

export default mongoose.model("Support", SupportSchema);
