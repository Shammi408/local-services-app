import mongoose from "mongoose";

const ServiceSchema = new mongoose.Schema(
  {
    // Name of service (e.g. Plumbing, Tutoring, etc.)
    title: { type: String, required: true, trim: true },

    // Detailed description
    description: { type: String, trim: true },

    // Category (helps with search/filter later)
    category: { type: String, trim: true },

    // Price per unit/hour
    price: { type: Number, required: true },

    // Reference to provider (User who created this service)
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Availability toggle
    isAvailable: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export default mongoose.model("Service", ServiceSchema);
