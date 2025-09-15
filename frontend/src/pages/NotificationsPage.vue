<template>
  <div class="page notifications-page">
    <h1>Notifications</h1>

    <div class="controls">
      <button class="btn" @click="load(true)" :disabled="loading">Refresh</button>
      <button class="btn outline" @click="markAllRead" :disabled="loading || items.length===0">Mark all read</button>
    </div>

    <div v-if="loading" class="muted">Loading…</div>

    <div v-else>
      <div v-if="items.length === 0" class="muted">No notifications</div>

      <div v-for="n in items" :key="n._id" :class="['note', { unread: !n.isRead }]" @click="openNotification(n)">
        <div class="note-head">
          <strong>{{ n.payload?.title ?? n.title ?? (n.type || 'Notification') }}</strong>
          <small class="muted"> • {{ formatDate(n.createdAt) }}</small>
        </div>
        <div class="note-body">{{ n.payload?.message ?? n.payload?.text ?? n.payload ?? '' }}</div>
        <div class="note-actions">
          <button class="tiny" @click.stop="markRead(n)" v-if="!n.isRead">Mark read</button>
        </div>
      </div>

      <div class="pager" v-if="total > limit">
        <button @click="changePage(page-1)" :disabled="page<=1">Prev</button>
        <span> Page {{page}} </span>
        <button @click="changePage(page+1)" :disabled="page*limit >= total">Next</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import api from "../utils/api";
import socket from "../utils/socket";
import { useRouter } from "vue-router";

const items = ref([]);
const loading = ref(false);
const page = ref(1);
const limit = ref(20);
const total = ref(0);
const router = useRouter();

async function load(reset=false) {
  loading.value = true;
  try {
    if (reset) page.value = 1;
    const res = await api.get(`/notifications?page=${page.value}&limit=${limit.value}`);
    // support res shape { total, page, limit, items }
    const body = res?.body ?? res ?? {};
    items.value = body.items ?? body;
    total.value = body.total ?? (Array.isArray(items.value) ? items.value.length : 0);
  } catch (err) {
    console.error("Failed to load notifications", err);
    items.value = [];
  } finally {
    loading.value = false;
  }
}

function formatDate(d) {
  try { return new Date(d).toLocaleString(); } catch { return d; }
}

async function markRead(n) {
  try {
    await api.put(`/notifications/${n._id}/read`);
    n.isRead = true;
  } catch (e) {
    console.warn("markRead failed", e);
  }
}

async function markAllRead() {
  try {
    const unread = items.value.filter(i => !i.isRead);
    await Promise.all(unread.map(i => api.put(`/notifications/${i._id}/read`).then(()=> i.isRead = true).catch(()=>{})));
  } catch (e) { console.warn(e); }
}

function openNotification(n) {
  // mark read then navigate to payload.link if present
  if (!n.isRead) markRead(n).catch(()=>{});
  const link = n.payload?.link ?? null;
  if (link) {
    // If link is absolute or relative to app, use router
    router.push(link).catch(()=>{ window.location.href = link; });
  }
}

function changePage(p) {
  if (p < 1) return;
  page.value = p;
  load();
}

onMounted(async () => {
  await load();

  // optional: listen for incoming socket notifications and prepend
  try {
    socket.on && socket.on("notification:new", (n) => {
      if (!n) return;
      // ignore if not for this user (server should only emit to correct room)
      items.value.unshift(n);
      total.value = (total.value || 0) + 1;
    });
  } catch (e) {}
});
</script>

<style scoped>
.page { max-width:900px; margin:20px auto; padding:12px; }
.note { padding:12px; border-radius:8px; margin-bottom:10px; border:1px solid #eef2f7; cursor:pointer; background:#fff; }
.note.unread { background:#f8fafc; }
.note-head { display:flex; gap:8px; align-items:center; }
.note-body { margin-top:6px; color:#111827; }
.controls { display:flex; gap:8px; margin-bottom:12px; }
.pager { display:flex; gap:8px; align-items:center; margin-top:12px; }
.tiny { font-size:12px; padding:6px 8px; border-radius:6px; }
</style>
