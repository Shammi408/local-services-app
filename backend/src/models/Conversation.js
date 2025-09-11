import mongoose from "mongoose";

const ConversationSchema = new mongoose.Schema({
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }], // usually 2: user + provider
  lastMessageAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model("Conversation", ConversationSchema);
