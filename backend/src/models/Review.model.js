
import mongoose from "mongoose";

const ReviewSchema = new mongoose.Schema(
  { 
    // User who booked the service
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // Service being reviewed
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },
    // Rating and comment
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true },
  },
  { timestamps: true }
);

// prevent user creating multiple reviews for same service (optional, enforced at app level too)
ReviewSchema.index({ userId: 1, serviceId: 1 }, { unique: true });

export default mongoose.model("Review", ReviewSchema);
