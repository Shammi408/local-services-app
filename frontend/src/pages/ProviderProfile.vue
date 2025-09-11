<template>
  <div class="page">
    <div v-if="loading" class="small">Loading provider…</div>

    <div v-else-if="error" class="card" style="color:crimson">
      {{ error }}
    </div>

    <div v-else class="profile">
      <div class="header card">
        <img :src="provider.profilePic || placeholder" alt="avatar" class="avatar" />
        <div class="meta">
          <h1 class="name">{{ provider.name }}</h1>
          <div class="muted">{{ provider.email }}</div>
          <div class="muted">Phone: {{ provider.phone || "—" }}</div>
          <div class="muted">Location: {{ provider.address || "—" }}</div>
          <div style="margin-top:8px">
            <span class="role-badge">Role: {{ provider.role || "provider" }}</span>
            <span class="verified" v-if="provider.isVerified"> • Verified</span>
            <span class="verified pending" v-else> • Not verified</span>
          </div>

          <p class="about" v-if="provider.experience">{{ provider.experience }}</p>

          <div class="actions">
            <router-link :to="`/services?providerId=${providerId}`" class="btn">
              View services
            </router-link>

            <button v-if="auth.user" class="btn secondary" @click="messageProvider">
              Message provider
            </button>

            <router-link v-if="canEdit" to="/profile" class="btn secondary">
              Edit profile
            </router-link>
          </div>
        </div>
      </div>

      <!-- Services preview -->
      <div class="card services-preview" v-if="servicesLoading">
        <div class="small">Loading services…</div>
      </div>

      <div class="card services-preview" v-else>
        <h3>Services by {{ provider.name }}</h3>

        <div v-if="services.length === 0" class="muted small">No services published yet.</div>

        <div class="grid" v-else>
          <div v-for="s in services" :key="s._id" class="svc-card">
            <div class="thumb">
              <img :src="s.images?.[0] || placeholderService" alt="" />
            </div>
            <div class="svc-body">
              <h4 class="svc-title">{{ s.title }}</h4>
              <div class="muted">₹{{ s.price ?? "—" }}</div>
              <router-link :to="`/services/${s._id}`" class="small">View</router-link>
            </div>
          </div>
        </div>

        <div style="margin-top:12px">
          <router-link :to="`/services?providerId=${providerId}`" class="btn secondary">
            See all services
          </router-link>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import api from "../utils/api";
import { useAuthStore } from "../stores/auth";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const providerId = route.params.id || route.query.providerId || null;

const provider = ref({});
const services = ref([]);
const loading = ref(true);
const servicesLoading = ref(false);
const error = ref("");

const placeholder = "/placeholder-avatar.png";
const placeholderService = "/placeholder-service.png";

const canEdit = computed(() => {
  // If the logged-in user is viewing their own profile, show Edit button
  const uid = auth.user?.id ?? auth.user?._id;
  return uid && (provider._id ?? provider.id) && uid.toString() === (provider._id ?? provider.id).toString();
});

async function loadProvider() {
  loading.value = true;
  error.value = "";
  if (!providerId) {
    error.value = "Provider id missing in the URL.";
    loading.value = false;
    return;
  }
  try {
    const res = await api.get(`/profile/${providerId}`);
    const body = res.body ?? res;
    provider.value = body;
  } catch (err) {
    console.error("Failed to load provider:", err);
    error.value = err?.body?.error || err?.message || "Failed to load provider";
  } finally {
    loading.value = false;
  }
}

async function loadServicesPreview() {
  servicesLoading.value = true;
  try {
    // re-use public services endpoint with providerId filter, limit small
    const qs = `?providerId=${encodeURIComponent(providerId)}&limit=6`;
    const res = await api.get(`/services${qs}`);
    const body = res.body ?? res;
    // supports both { items, ... } or array
    services.value = Array.isArray(body) ? body : (body.items ?? []);
  } catch (err) {
    console.error("Failed to load services preview:", err);
    // don't show harsh error; keep services empty
    services.value = [];
  } finally {
    servicesLoading.value = false;
  }
}

function messageProvider() {
  // naive routing to a chat creation page - adjust when chat exists
  if (!auth.user) {
    router.push({ path: "/login", query: { redirect: route.fullPath } });
    return;
  }
  // Example: navigate to a chat-creation route. Replace with your chat flow.
  router.push({ path: `/chats/new`, query: { providerId } });
}

onMounted(async () => {
  await loadProvider();
  // load services preview (non-blocking)
  loadServicesPreview();
});
</script>

<style scoped>
.page {
  padding: 24px;
  max-width: 1000px;
  margin: 0 auto;
}

/* header card */
.header {
  display:flex;
  gap:18px;
  align-items:flex-start;
  padding:16px;
}
.avatar {
  width:120px;
  height:120px;
  border-radius:12px;
  object-fit:cover;
  box-shadow:0 8px 26px rgba(2,6,23,0.06);
}
.meta { flex:1; min-width:0; }
.name { margin:0 0 6px 0; font-size:22px; }
.muted { color:#6b7280; }
.about { margin-top:8px; color:#374151; }

/* actions */
.actions { margin-top:12px; display:flex; gap:8px; align-items:center; }
.btn { background:#2563eb; color:white; padding:8px 12px; border-radius:8px; border:none; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; }
.btn.secondary { background:transparent; border:1px solid #e6eef8; color:#0f1724; padding:6px 10px; }

/* role badge */
.role-badge { display:inline-block; padding:6px 10px; border-radius:999px; background:#eef2ff; color:#3730a3; font-weight:600; }

/* services preview */
.services-preview { margin-top:16px; padding:16px; }
.grid { display:grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap:12px; margin-top:12px; }
.svc-card { background:#fff; padding:10px; border-radius:10px; box-shadow:0 6px 18px rgba(2,6,23,0.04); display:flex; gap:10px; align-items:center; }
.thumb { width:84px; height:64px; overflow:hidden; border-radius:8px; flex:0 0 84px; }
.thumb img { width:100%; height:100%; object-fit:cover; display:block; }
.svc-body { flex:1; min-width:0; }
.svc-title { margin:0 0 6px 0; font-size:15px; }

/* small text */
.small { font-size:13px; color:#6b7280; }

@media (max-width:760px) {
  .header { flex-direction:column; align-items:center; text-align:center; }
  .meta { margin-top:8px; }
  .actions { justify-content:center; }
}
</style>
