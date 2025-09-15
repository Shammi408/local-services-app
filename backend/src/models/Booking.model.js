import mongoose from "mongoose";

const BookingSchema = new mongoose.Schema(
  {
    // User who booked the service
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Provider of the service (we keep it for quick access)
    providerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    // Which service is booked
    serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "Service", required: true },

    // Date/time of booking
    date: { type: Date, required: true },

    // Booking status
    status: {
      type: String,
      enum: ["pending", "confirmed", "completed", "cancelled"],
      default: "pending"
    },
    paid: { type: Boolean, default: false },
    paymentId: { type: mongoose.Schema.Types.ObjectId, ref: "Payment", default: null },
  },
  { timestamps: true }
);

export default mongoose.model("Booking", BookingSchema);
