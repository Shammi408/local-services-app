import mongoose from "mongoose";

const PaymentSchema = new mongoose.Schema({
  bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking" },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  providerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  amount: { type: Number, required: true },
  providerOrderId: { type: String }, // id from payment gateway
  status: { type: String, enum: ["created","paid","failed"], default: "created" },
  meta: { type: Object }
}, { timestamps: true });

export default mongoose.model("Payment", PaymentSchema);
