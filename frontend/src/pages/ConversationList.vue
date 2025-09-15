<template>
  <div class="page">
    <div class="header-row">
      <div class="title-block">
        <h1>Messages</h1>
        <div class="small muted">All your conversations</div>
      </div>

      <div class="controls">
        <input v-model="q" @input="filter" placeholder="Search conversations..." class="search" />
      </div>
    </div>

    <div v-if="loading" class="card info">Loading…</div>
    <div v-else-if="error" class="card error">{{ error }}</div>
    <div v-else>
      <div v-if="filtered.length === 0" class="card empty">No conversations yet</div>
      <div v-else class="list">
        <div
          v-for="c in filtered"
          :key="c._id"
          :class="['card convo-row', { active: c._id === activeId }]"
          @click="openConvo(c._id)"
          role="button"
          tabindex="0"
        >
          <div class="row-left">
            <div class="avatar-wrap">
              <img
                v-if="c.other?.profilePic"
                :src="c.other.profilePic"
                alt=""
                class="avatar"
              />
              <div v-else class="avatar placeholder"></div>
            </div>

            <div class="meta">
              <div class="name">{{ c.other?.name || "Unknown" }}</div>
              <div class="preview small muted">{{ c.lastMessage?.text || "No messages yet" }}</div>
            </div>
          </div>

          <div class="row-right">
            <div class="time small muted">{{ prettyDate(c.lastMessageAt || c.lastMessage?.createdAt) }}</div>
            <div v-if="c.unreadCount > 0" class="badge">{{ c.unreadCount }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import api from "../utils/api";
import { useRouter } from "vue-router";
import socket, { joinSocket } from "../utils/socket";
import { useAuthStore } from "../stores/auth";

const convos = ref([]);
const loading = ref(false);
const error = ref("");
const q = ref("");
const router = useRouter();
const auth = useAuthStore();
const activeId = ref(null);

function prettyDate(d) {
  if (!d) return "-";
  try {
    const dt = new Date(d);
    // show today/time else short date
    const now = new Date();
    const sameDay = dt.toDateString() === now.toDateString();
    return sameDay ? dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : dt.toLocaleDateString();
  } catch {
    return d;
  }
}

async function loadConvos() {
  loading.value = true;
  error.value = "";
  try {
    const res = await api.get("/chat/conversations");
    convos.value = (res.body ?? res) || [];
    // cache active id from route if present
    activeId.value = router.currentRoute.value.params.id ?? null;
  } catch (err) {
    console.error("loadConvos error", err);
    error.value = err?.body?.error || err?.message || "Failed to load conversations";
  } finally {
    loading.value = false;
  }
}

function openConvo(id) {
  router.push({ path: `/chats/${id}` });
  activeId.value = id;
}

onMounted(() => {
  loadConvos();
  joinSocket(auth.user?.id ?? auth.user?._id);

  // reload list when a message arrives or is read
  socket.on("receiveMessage", () => loadConvos());
  socket.on("messagesRead", () => loadConvos());
});

// client-side simple filter
const filtered = computed(() => {
  const term = (q.value || "").toLowerCase().trim();
  if (!term) return convos.value;
  return convos.value.filter(c => {
    const name = (c.other?.name || "").toLowerCase();
    const preview = (c.lastMessage?.text || "").toLowerCase();
    return name.includes(term) || preview.includes(term);
  });
});

function filter() {
  // computed `filtered` reacts to q
}
</script>

<style scoped>
.page { max-width:900px; margin:20px auto; padding: 12px; }
.header-row { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:12px; flex-wrap:wrap; }
.title-block h1 { margin:0; font-size:24px; }
.controls { display:flex; align-items:center; gap:8px; }
.search { padding:8px 10px; border-radius:8px; border:1px solid #e6eef8; min-width:220px; }

.card { background:white; padding:12px; border-radius:10px; box-shadow:0 4px 14px rgba(2,6,23,0.04); }
.card.info { color:#374151; }
.card.error { color:crimson; }
.card.empty { text-align:center; color:#6b7280; }

.list { display:flex; flex-direction:column; gap:8px; margin-top:8px; }

/* conversation row */
.convo-row { display:flex; justify-content:space-between; align-items:center; gap:12px; padding:12px; cursor:pointer; transition:background 0.12s, transform .06s; }
.convo-row:hover { background:#f8fafc; transform:translateY(-1px); }
.convo-row.active { background:#eef2ff; border:1px solid rgba(37,99,235,0.08); box-shadow: inset 0 0 0 1px rgba(37,99,235,0.02); }

.row-left { display:flex; gap:12px; align-items:center; flex:1; min-width:0; }
.avatar-wrap { width:48px; height:48px; flex:0 0 48px; }
.avatar { width:48px; height:48px; border-radius:8px; object-fit:cover; display:block; }
.avatar.placeholder { background:#f3f4f6; border-radius:8px; width:48px; height:48px; }

.meta { min-width:0; }
.name { font-weight:700; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.preview { color:#6b7280; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

/* right column */
.row-right { display:flex; flex-direction:column; align-items:flex-end; gap:6px; min-width:72px; }
.time { font-size:12px; color:#6b7280; }
.badge {
  display:inline-block;
  padding:6px 10px;
  background:#ef4444;
  color:white;
  border-radius:999px;
  font-size:12px;
  min-width:32px;
  text-align:center;
}
.small { font-size:13px; color:#6b7280; }

/* small screens: condense layout */
@media (max-width:600px) {
  .page { padding:8px; }
  .header-row { align-items:flex-start; }
  .search { width:100%; }
  .row-right { min-width:60px; align-items:flex-end; }
}
</style>
