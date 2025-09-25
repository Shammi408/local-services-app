import mongoose from "mongoose";

// to provide user with notifications we save thier info
const SubSchema = new mongoose.Schema({
  endpoint: { type: String, required: true, unique: true },
  keys: {
    p256dh: { type: String },
    auth: { type: String }
  },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  createdAt: { type: Date, default: Date.now }
});

SubSchema.index({ userId: 1 });
export default mongoose.model("Subscription", SubSchema);

