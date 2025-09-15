<template>
  <div class="notif-bell" ref="root">
    <button @click="togglePanel" class="bell-btn" :aria-expanded="open ? 'true' : 'false'">
      🔔
      <span v-if="unreadCount > 0" class="badge" aria-live="polite">{{ unreadCount }}</span>
    </button>

    <div v-if="open" class="panel" role="dialog" aria-label="Notifications panel">
      <div v-if="loading" class="panel-empty">Loading…</div>

      <div v-else>
        <div v-if="items.length === 0" class="panel-empty muted">No notifications</div>

        <div v-for="n in items" :key="n._id" class="note" :class="{ unread: !n.isRead }">
          <div class="note-row">
            <div>
              <div class="title">{{ titleFor(n) }}</div>
              <div class="muted small">{{ formatDate(n.createdAt) }}</div>
            </div>
            <div>
              <button v-if="!n.isRead" class="mark-btn" @click.stop="markRead(n)">Mark read</button>
            </div>
          </div>
          <div class="text">{{ n.payload?.message ?? n.payload?.text ?? JSON.stringify(n.payload || {}) }}</div>
        </div>

        <div v-if="items.length > 0" class="panel-footer">
          <button class="btn" @click="markAllRead">Mark all read</button>
          <router-link to="/notifications" class="btn secondary" @click="closePanel">View all</router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import api from "../utils/api";
import socket from "../utils/socket"; // ensure this exists and exports default socket
import { useRouter } from "vue-router";

const items = ref([]);
const loading = ref(false);
const open = ref(false);
const unreadCount = ref(0);
const page = ref(1);
const limit = ref(20);
const root = ref(null);
const pollInterval = ref(null);

const router = useRouter();

async function load() {
  loading.value = true;
  try {
    const res = await api.get(`/notifications?page=${page.value}&limit=${limit.value}`);
    // support various shapes
    items.value = res?.items ?? res?.body?.items ?? res?.body ?? res ?? [];
  } catch (err) {
    // swallow: UI shows empty
    items.value = [];
  } finally {
    loading.value = false;
    updateUnreadCount();
  }
}

async function loadUnreadCount() {
  try {
    const res = await api.get("/notifications/unread-count");
    unreadCount.value = (res?.body?.unread ?? res?.unread) || 0;
  } catch (err) {
    unreadCount.value = items.value.filter(i => !i.isRead).length;
  }
}

function updateUnreadCount() {
  // compute from loaded items and also fetch server count
  unreadCount.value = items.value.filter(i => !i.isRead).length;
  // also attempt server count (non-blocking)
  loadUnreadCount().catch(()=>{});
}

function togglePanel() {
  open.value = !open.value;
  if (open.value) load();
}

function closePanel() {
  open.value = false;
}

async function markRead(n) {
  try {
    await api.put(`/notifications/${n._id}/read`);
    n.isRead = true;
    updateUnreadCount();
  } catch (err) {
    // ignore
  }
}

async function markAllRead() {
  try {
    const unread = items.value.filter(i => !i.isRead);
    await Promise.all(unread.map(i => api.put(`/notifications/${i._id}/read`).then(()=> i.isRead = true).catch(()=>{})));
    updateUnreadCount();
  } catch (e) {}
}

// small ephemeral toast
function showToast(text) {
  if (typeof document === "undefined") return;
  const el = document.createElement("div");
  el.textContent = text;
  Object.assign(el.style, {
    position: "fixed",
    right: "16px",
    bottom: "16px",
    background: "#111827",
    color: "#fff",
    padding: "10px 14px",
    borderRadius: "8px",
    zIndex: 99999,
  });
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// click-outside to close panel
function onDocClick(e) {
  if (!root.value) return;
  if (!root.value.contains(e.target)) open.value = false;
}

// socket notifications
function onSocketNotification(n) {
  // If server emits saved notification object, prepend it
  if (!n) return;
  items.value.unshift(n);
  updateUnreadCount();
  showToast(n.payload?.message ?? "New notification");
}
function titleFor(n) {
  // prefer explicit title in payload, then type fallback
  const t = n?.payload?.title ?? n?.title ?? n?.type ?? "Notification";
  // make it human readable
  return String(t).replace(/\./g, " ");
}

function formatDate(d) {
  try { return new Date(d).toLocaleString(); } catch { return ""; }
}
onMounted(() => {
  // initial counts
  load();
  loadUnreadCount();
  // poll for new notifications count every 30s (non-blocking)
  pollInterval.value = setInterval(() => loadUnreadCount().catch(()=>{}), 30000);

  // socket
  try {
    socket.on && socket.on("notification:new", onSocketNotification);
  } catch (e) {}

  document.addEventListener("click", onDocClick);
});

onBeforeUnmount(() => {
  clearInterval(pollInterval.value);
  try { socket.off && socket.off("notification:new", onSocketNotification); } catch (e) {}
  document.removeEventListener("click", onDocClick);
});
</script>

<style scoped>
.notif-bell { position: relative; }
.bell-btn {
  background: transparent; border: 0; cursor: pointer; font-size: 18px; padding: 6px 8px;
}
.badge {
  display:inline-block; margin-left:6px; background:#ef4444; color:white; border-radius:999px; padding:2px 8px; font-size:12px;
}
.panel {
  position: absolute; right: 0; top: 42px; width: 320px; max-height: 420px; overflow: auto;
  background: white; border: 1px solid #e6e6e6; border-radius: 8px; box-shadow: 0 10px 30px rgba(2,6,23,0.06); z-index: 300;
  padding: 8px;
}
.panel-empty { padding: 16px; text-align:center; color:#6b7280; }
.note { padding: 10px; border-radius: 8px; margin-bottom: 8px; background: #fff; border: 1px solid #f3f4f6; }
.note.unread { background: #f8fafc; }
.note-row { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; }
.title { font-weight:700; }
.muted { color:#6b7280; }
.text { margin-top:6px; color:#0b1220; font-size:14px; }
.panel-footer { display:flex; gap:8px; justify-content:flex-end; padding:8px 4px; border-top:1px solid #f3f4f6; margin-top:8px; }
.btn { background:#2563eb; color:white; padding:6px 8px; border-radius:6px; border:none; cursor:pointer; }
.btn.secondary { background:transparent; border:1px solid #e6eef8; color:#0f1724; padding:6px 8px; }
.mark-btn { background:transparent; border:1px solid #e6eef8; padding:6px 8px; border-radius:6px; cursor:pointer; }
.small { font-size:13px; }
</style>
