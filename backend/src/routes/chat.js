// routes/chat.js
import express from "express";
import Conversation from "../models/Conversation.js";
import Message from "../models/Message.js";
import User from "../models/User.model.js"; // populate names/emails
import { requireAuth } from "../middleware/auth.js";
import { notifyUserNewMessage, createNotification } from "../utils/notify.js";

export default function createChatRouter(io) {
  const router = express.Router();

  // Create or get conversation
  router.post("/conversation", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const otherId = req.body.participantId;
      if (!otherId) return res.status(400).json({ error: "participantId required" });

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

  // List conversations for current user
  router.get("/conversations", requireAuth, async (req, res) => {
    try {
      const userId = req.user.id;
      const convos = await Conversation.find({ participants: userId })
        .sort({ lastMessageAt: -1 })
        .limit(200)
        .lean();

      const results = await Promise.all(convos.map(async (c) => {
        const otherId = c.participants.find(p => p.toString() !== userId.toString());
        const other = otherId ? await User.findById(otherId).select("name email profilePic").lean() : null;

        const lastMsg = await Message.findOne({ conversationId: c._id }).sort({ createdAt: -1 }).lean();
        const unreadCount = await countUnread(c._id, userId);

        return {
          _id: c._id,
          other: other ? { id: other._id, name: other.name, email: other.email, profilePic: other.profilePic } : null,
          lastMessage: lastMsg ? { text: lastMsg.text, senderId: lastMsg.senderId, createdAt: lastMsg.createdAt } : null,
          lastMessageAt: c.lastMessageAt,
          unreadCount
        };
      }));

      res.json(results);
    } catch (err) {
      console.error("GET /chat/conversations error:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // Get a single conversation
  router.get("/conversation/:id", requireAuth, async (req, res) => {
    try {
      const convId = req.params.id;
      const convo = await Conversation.findById(convId).lean();
      if (!convo) return res.status(404).json({ error: "Conversation not found" });

      if (!convo.participants.map(String).includes(req.user.id)) {
        return res.status(403).json({ error: "Not participant of this conversation" });
      }

      const participants = await User.find({ _id: { $in: convo.participants } }).select("name email profilePic").lean();
      res.json({ ...convo, participants });
    } catch (err) {
      console.error("GET /chat/conversation/:id error:", err);
      res.status(500).json({ error: "Server error" });
    }
  });
  
  // Get messages (populate sender info)
  router.get("/conversation/:id/messages", requireAuth, async (req, res) => {
    try {
      const convId = req.params.id;
      const since = req.query.since ? new Date(req.query.since) : null;
      const filter = { conversationId: convId };
      if (since) filter.createdAt = { $gt: since };

      // populate senderId (name + profilePic)
      const messages = await Message.find(filter)
        .sort({ createdAt: 1 })
        .limit(200)
        .populate("senderId", "name profilePic")
        .lean();

      // Normalize shape for frontend: include senderName and senderProfile if populated
      const shaped = messages.map(m => ({
        _id: m._id,
        conversationId: m.conversationId,
        senderId: m.senderId?._id ?? m.senderId,
        senderName: m.senderId?.name ?? null,
        senderProfilePic: m.senderId?.profilePic ?? null,
        text: m.text,
        attachments: m.attachments ?? [],
        readBy: m.readBy ?? [],
        createdAt: m.createdAt
      }));

      res.json(shaped);
    } catch (err) {
      console.error("GET /chat/messages error:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  // Send message (existing, with emit)
// POST /conversation/:id/message
router.post("/conversation/:id/message", requireAuth, async (req, res) => {
  try {
    const conv = await Conversation.findById(req.params.id);
    if (!conv) return res.status(404).json({ error: "Conversation not found" });

    if (!conv.participants.map(String).includes(req.user.id)) {
      return res.status(403).json({ error: "Not participant of this conversation" });
    }

    const msg = new Message({
      conversationId: conv._id,
      senderId: req.user.id,
      text: req.body.text || "",
      attachments: req.body.attachments || [],
      readBy: [req.user.id]
    });

    await msg.save();

    conv.lastMessageAt = new Date();
    await conv.save();

    const populated = await Message.findById(msg._id)
      .populate("senderId", "name profilePic")
      .lean();

    const payload = {
      _id: populated._id,
      conversationId: populated.conversationId,
      senderId: populated.senderId?._id ?? populated.senderId,
      senderName: populated.senderId?.name ?? null,
      senderProfilePic: populated.senderId?.profilePic ?? null,
      text: populated.text,
      attachments: populated.attachments ?? [],
      createdAt: populated.createdAt
    };

    // Emit the live chat message to other participants' socket rooms
    conv.participants.forEach((p) => {
      if (p.toString() !== req.user.id) {
        try {
          io.to(p.toString()).emit("receiveMessage", payload);
        } catch (e) {
          console.warn("Socket emit receiveMessage failed for", p.toString(), e?.message || e);
        }
      }
    });

    // Fire-and-forget: create notification(s) for recipients and emit them
    (async () => {
      try {
        const recipients = conv.participants.filter(p => p.toString() !== req.user.id);

        // build array of promises (each will create a notif and emit it)
        const tasks = recipients.map(async (recipientId) => {
          try {
            const notif = await notifyUserNewMessage({
              recipientId,
              senderId: req.user.id,
              senderName: req.user.name || req.user.email || "Someone",
              text: payload.text || "",
              conversationId: payload.conversationId,
              messageId: payload._id
            });

            if (notif && io) {
              try {
                io.to(String(recipientId)).emit(
                  "notification:new",
                  notif.toObject ? notif.toObject() : notif
                );
              } catch (emitErr) {
                console.warn("Failed to emit notification:new to", recipientId, emitErr?.message || emitErr);
              }
            }
          } catch (innerErr) {
            console.warn("notifyUserNewMessage failed for", recipientId, innerErr?.message || innerErr);
          }
        });

        // wait for all to settle (don't block main response)
        await Promise.allSettled(tasks);
      } catch (bgErr) {
        console.warn("Background notification error (chat message):", bgErr?.message || bgErr);
      }
    })();

    // respond to the API caller (sender) immediately
    res.status(201).json(payload);

  } catch (err) {
    console.error("POST /chat/message error:", err);
    res.status(500).json({ error: "Server error" });
  }
});


  // Mark messages in this conversation as read by current user
  // POST /api/chat/conversation/:id/read
router.post("/conversation/:id/read", requireAuth, async (req, res) => {
    try {
      const convId = req.params.id;
      const userId = req.user.id;

      const conv = await Conversation.findById(convId);
      if (!conv) return res.status(404).json({ error: "Conversation not found" });
      if (!conv.participants.map(String).includes(userId)) return res.status(403).json({ error: "Not participant" });

      const upd = await Message.updateMany(
        { conversationId: convId, readBy: { $ne: userId } },
        { $addToSet: { readBy: userId } }
      );

      conv.participants.forEach((p) => {
        if (p.toString() !== userId) {
          io.to(p.toString()).emit("messagesRead", { conversationId: convId, readerId: userId });
        }
      });

      const unreadAfter = await countUnread(convId, userId);
      res.json({ modified: upd.modifiedCount ?? upd.nModified ?? 0, unread: unreadAfter });
    } catch (err) {
      console.error("POST /chat/conversation/:id/read error:", err);
      res.status(500).json({ error: "Server error" });
    }
  });

  async function countUnread(convId, userId) {
    return await Message.countDocuments({
      conversationId: convId,
      readBy: { $ne: userId }
    });
  }

  return router;
}