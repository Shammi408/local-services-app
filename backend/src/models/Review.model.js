// models/Review.model.js
import mongoose from "mongoose";

const ImageSchema = new mongoose.Schema(
  {
    url: { type: String },
    public_id: { type: String, default: null },
  },
  { _id: false }
);

const ReviewSchema = new mongoose.Schema(
  {
    // User who booked the service
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    // Service being reviewed
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },
    // Rating and comment
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, trim: true },

    // Optional images uploaded with review (max 2)
    images: {
      type: [ImageSchema],
      validate: {
        validator: function (arr) {
          return !arr || arr.length <= 2;
        },
        message: "Maximum 2 images allowed per review",
      },
      default: []
    }
  },
  { timestamps: true }
);

// prevent user creating multiple reviews for same service (optional, enforced at app level too)
ReviewSchema.index({ userId: 1, serviceId: 1 }, { unique: true });

export default mongoose.model("Review", ReviewSchema);
