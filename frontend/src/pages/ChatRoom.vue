<template>
  <div class="page chat-page">
    <div class="chat-header">
      <h2 class="chat-title">{{ title || "Chat" }}</h2>
      <div class="chat-sub muted">{{ subtitle }}</div>
    </div>

    <div ref="messagesBox" class="messages" aria-live="polite">
      <div
        v-for="m in messages"
        :key="m._id"
        :class="['msg', { me: isMe(m.senderId) }]"
      >
        <div class="bubble">
          <div class="meta">
            <strong class="sender">{{ isMe(m.senderId) ? 'You' : (m.senderName || 'Them') }}</strong>
            <span class="muted timestamp"> • {{ prettyDate(m.createdAt) }}</span>
          </div>

          <!-- show text -->
          <div v-if="m.text" class="text">{{ m.text }}</div>

          <!-- show attachments (images) -->
          <div v-if="m.attachments && m.attachments.length" class="attachments">
            <img
              v-for="(a, i) in m.attachments"
              :key="i"
              :src="a"
              class="attachment-img"
              alt="attachment"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="compose">
      <input
        v-model="newMsg"
        @keyup.enter="sendMessage"
        placeholder="Type a message..."
        :disabled="sending"
      />

      <!-- file chooser (single file) -->
      <label class="file-btn" :class="{ disabled: sending }">
        📎
        <input type="file" accept="image/*" @change="onFileSelected" />
      </label>

      <!-- preview of selected file (local) -->
      <div v-if="filePreview" class="preview-wrap">
        <img :src="filePreview" class="preview-img" alt="preview" />
        <button class="tiny remove" @click="removeSelectedFile" :disabled="sending">✕</button>
      </div>

      <button class="btn" @click="sendMessage" :disabled="sending || (!newMsg.trim() && !selectedFile)">
        <span v-if="sending">{{ sendingLabel }}</span>
        <span v-else>Send</span>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from "vue";
import { useRoute } from "vue-router";
import api from "../utils/api";
import socket, { joinSocket } from "../utils/socket";
import { useAuthStore } from "../stores/auth";

const route = useRoute();
const convoId = route.params.id;
const auth = useAuthStore();

const messages = ref([]);
const newMsg = ref("");
const messagesBox = ref(null);
const sending = ref(false);
const sendingLabel = ref("Sending…");

const title = ref("");
const subtitle = ref("");

// local selected file state (not uploaded until send)
const selectedFile = ref(null); // File object
const filePreview = ref(""); // data URL

function isMe(senderId) {
  const me = auth.user?.id ?? auth.user?._id;
  return String(senderId) === String(me);
}

function prettyDate(d) {
  try {
    const dt = new Date(d);
    return dt.toLocaleString();
  } catch {
    return d;
  }
}

async function loadMessages() {
  try {
    const res = await api.get(`/chat/conversation/${convoId}/messages`);
    messages.value = (res.body ?? res) || [];
    // update header info (use other participant's name if available)
    if (messages.value.length) {
      const other = messages.value.find(m => !isMe(m.senderId));
      title.value = other?.senderName ?? "";
    }
    await api.post(`/chat/conversation/${convoId}/read`).catch(() => {});
  } catch (err) {
    console.error("loadMessages error", err);
  }
}

function scrollToBottom({ behavior = "auto" } = {}) {
  const el = messagesBox.value;
  if (!el) return;
  try {
    el.scrollTop = el.scrollHeight;
    setTimeout(() => {
      if (behavior === "smooth" && "scrollTo" in el) {
        try { el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }); } catch(e) {}
      } else {
        el.scrollTop = el.scrollHeight;
      }
    }, 50);
  } catch (e) {
    window.scrollTo(0, document.body.scrollHeight);
  }
}

/**
 * Upload image to /api/uploads/image using fetch + FormData.
 * Uses api._API_BASE if available to build absolute URL (avoid Vite proxy problems).
 * Returns uploaded object { url, public_id } or throws.
 */
async function uploadImage(file, onProgress = null) {
  if (!file) throw new Error("file required");

  // Build upload URL
  const API_BASE = (api._API_BASE || import.meta.env.VITE_API_BASE || "http://localhost:3000").replace(/\/+$/, "");
  const uploadUrl = API_BASE.endsWith("/api") ? `${API_BASE}/uploads/image` : `${API_BASE}/api/uploads/image`;

  const formData = new FormData();
  formData.append("file", file);

  // Use fetch because api.post doesn't support multipart in this helper
  const token = localStorage.getItem("token");
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  // Simple fetch with no progress events (for XHR progress you'd need XMLHttpRequest)
  const resp = await fetch(uploadUrl, {
    method: "POST",
    headers,
    body: formData
  });

  if (!resp.ok) {
    const txt = await resp.text().catch(() => null);
    throw { status: resp.status, body: txt, message: "Upload failed" };
  }
  const body = await resp.json().catch(() => null);
  if (!body || !body.url) throw new Error("Upload response invalid");
  return body;
}

async function sendMessage() {
  if (!newMsg.value?.trim() && !selectedFile.value) return;
  sending.value = true;
  sendingLabel.value = "Uploading image…";

  try {
    let attachmentUrls = [];

    // If there's a selected file, upload it first
    if (selectedFile.value) {
      try {
        const up = await uploadImage(selectedFile.value);
        attachmentUrls.push(up.url);
      } catch (upErr) {
        console.error("Image upload failed", upErr);
        alert("Image upload failed. Try again.");
        sending.value = false;
        return;
      }
    }

    sendingLabel.value = "Sending message…";

    // POST message with text and attachments array (backend expects attachments)
    const payload = {
      text: newMsg.value?.trim() || "",
      attachments: attachmentUrls
    };

    const res = await api.post(`/chat/conversation/${convoId}/message`, payload);
    const saved = res.body ?? res;

    // push into UI and reset inputs
    messages.value.push(saved);
    newMsg.value = "";
    selectedFile.value = null;
    filePreview.value = "";
    await nextTick();
    scrollToBottom({ behavior: "smooth" });
  } catch (err) {
    console.error("sendMessage failed", err);
    alert("Failed to send message.");
  } finally {
    sending.value = false;
    sendingLabel.value = "Sending…";
  }
}

function onFileSelected(e) {
  const f = e.target.files?.[0];
  if (!f) return;
  // optional: restrict size
  const MAX_MB = 8;
  if (f.size > MAX_MB * 1024 * 1024) {
    alert(`File too large. Max ${MAX_MB} MB allowed.`);
    e.target.value = "";
    return;
  }
  selectedFile.value = f;

  const reader = new FileReader();
  reader.onload = (ev) => {
    filePreview.value = ev.target.result;
  };
  reader.readAsDataURL(f);
  // clear file input element value so same file re-selection triggers change
  e.target.value = "";
}

function removeSelectedFile() {
  selectedFile.value = null;
  filePreview.value = "";
}

onMounted(async () => {
  joinSocket(auth.user?.id ?? auth.user?._id);

  socket.on("receiveMessage", async (msg) => {
    if (msg.conversationId && String(msg.conversationId) === String(convoId)) {
      messages.value.push(msg);
      await api.post(`/chat/conversation/${convoId}/read`).catch(() => {});
      await nextTick();
      scrollToBottom({ behavior: "smooth" });
    }
  });

  await loadMessages();
  await nextTick();
  scrollToBottom({ behavior: "auto" });
});

watch(() => messages.value.length, async () => {
  await nextTick();
  scrollToBottom({ behavior: "auto" });
});
</script>

<style scoped>
.page { max-width:900px; margin:20px auto; padding:12px; display:flex; flex-direction:column; gap:12px; }
.chat-header { display:flex; flex-direction:column; gap:4px; }
.chat-title { margin:0; font-size:20px; }
.chat-sub { font-size:13px; color:#6b7280; }

.messages { height:60vh; overflow:auto; border-radius:10px; padding:12px; background:#fff; box-shadow:0 4px 14px rgba(2,6,23,0.04); border:1px solid #eef2f7; }
.msg { display:flex; margin-bottom:10px; }
.msg .bubble { max-width:78%; padding:10px 12px; border-radius:10px; background:#f3f4f6; }
.msg.me { justify-content:flex-end; }
.msg.me .bubble { background:#dbeafe; border-top-right-radius:2px; border-top-left-radius:10px; border-bottom-left-radius:10px; border-bottom-right-radius:10px; }

.meta { margin-bottom:6px; font-size:12px; color:#6b7280; display:flex; gap:6px; align-items:center; }
.sender { font-weight:700; font-size:13px; color:#0f1724; }
.text { white-space:pre-wrap; word-break:break-word; color:#0b1220; line-height:1.4; }

/* attachments */
.attachments { margin-top:8px; display:flex; gap:8px; flex-wrap:wrap; }
.attachment-img { width:160px; height:110px; object-fit:cover; border-radius:8px; box-shadow:0 6px 12px rgba(0,0,0,0.06); }

/* compose area */
.compose { display:flex; gap:8px; align-items:center; margin-top:8px; }
.compose input[type="text"],
.compose input[type="email"],
.compose input[type="password"],
.compose input { flex:1; padding:10px 12px; border-radius:10px; border:1px solid #e6eef8; min-height:44px; font-size:14px; }

.file-btn {
  display:inline-flex;
  align-items:center;
  justify-content:center;
  width:42px;
  height:42px;
  border-radius:8px;
  background:#f3f4f6;
  cursor:pointer;
  border:1px solid #e6eef8;
  position:relative;
  overflow:hidden;
}
.file-btn input { position:absolute; left:0; top:0; width:100%; height:100%; opacity:0; cursor:pointer; }
.file-btn.disabled { opacity:0.6; pointer-events:none; }

.preview-wrap { position:relative; display:inline-block; width:60px; height:60px; }
.preview-img { width:60px; height:60px; object-fit:cover; border-radius:8px; box-shadow:0 6px 12px rgba(0,0,0,0.06); }
.preview-wrap .remove { position:absolute; top:-6px; right:-6px; background:#ef4444; color:white; border:none; border-radius:999px; width:22px; height:22px; cursor:pointer; }

.btn { background:#2563eb; color:white; padding:10px 14px; border-radius:10px; border:none; cursor:pointer; font-weight:600; }
.btn[disabled] { opacity:0.7; cursor:not-allowed; }

.muted { color:#6b7280; }
.timestamp { font-size:12px; color:#6b7280; }

@media (max-width:720px) {
  .messages { height:56vh; }
  .msg .bubble { max-width:86%; }
  .attachment-img { width:120px; height:90px; }
}
</style>
