import mongoose from "mongoose";

const NotificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  title: { type: String, default: "Notification" },
  body: { type: String, default: "" },
  type: { type: String, default: "" }, // e.g. 'booking.created', 'chat.message'
  payload: { type: mongoose.Schema.Types.Mixed, default: {} }, // arbitrary object for client
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
});

NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
export default mongoose.model("Notification", NotificationSchema);
