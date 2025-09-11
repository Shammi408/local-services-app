import express from "express";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import { requireAuth } from "../middleware/auth.js";

const router = express.Router();

/**
 * POST /api/chat/conversation
 * Create or return existing conversation between two users
 * Body: { participantId } // the other user's id
 */
router.post("/conversation", requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    const otherId = req.body.participantId;
    if (!otherId) return res.status(400).json({ error: "participantId required" });

    // find existing conversation with both participants
    let convo = await Conversation.findOne({ participants: { $all: [userId, otherId] } });
    if (!convo) {
      convo = new Conversation({ participants: [userId, otherId] });
      await convo.save();
    }
    res.json(convo);
  } catch (err) {
    console.error("POST /chat/conversation error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * GET /api/chat/conversation/:id/messages?since=<iso>
 * Get messages for a conversation. Optionally pass ?since=timestamp to fetch new messages (polling).
 */
router.get("/conversation/:id/messages", requireAuth, async (req, res) => {
  try {
    const convId = req.params.id;
    const since = req.query.since ? new Date(req.query.since) : null;
    const filter = { conversationId: convId };
    if (since) filter.createdAt = { $gt: since };

    const messages = await Message.find(filter).sort({ createdAt: 1 }).limit(200);
    res.json(messages);
  } catch (err) {
    console.error("GET /chat/messages error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/**
 * POST /api/chat/conversation/:id/message
 * Send a message
 * Body: { text, attachments? }
 */
router.post("/conversation/:id/message", requireAuth, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: "Conversation not found" });

    // verify user is participant
    if (!conv.participants.map(String).includes(req.user.id)) {
      return res.status(403).json({ error: "Not participant of this conversation" });
    }

    const msg = new Message({
      conversationId: conv._id,
      senderId: req.user.id,
      text: req.body.text || "",
      attachments: req.body.attachments || []
    });

    await msg.save();
    conv.lastMessageAt = new Date();
    await conv.save();

    // (Optional) trigger a notification entry here

    res.status(201).json(msg);
  } catch (err) {
    console.error("POST /chat/message error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
