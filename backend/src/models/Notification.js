import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  type: { type: String, required: true }, // e.g., 'booking', 'message', 'payment'
  payload: { type: Object }, // store extra info like { bookingId, messageId, text }
  isRead: { type: Boolean, default: false }
}, { timestamps: true });

export default mongoose.model("Notification", NotificationSchema);
