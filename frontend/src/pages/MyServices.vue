<template>
  <div class="page">
    <div class="header-row">
      <h1>My Services</h1>
      <router-link v-if="isProvider" to="/services/new" class="btn">+ Create Service</router-link>
    </div>

    <!-- still loading auth/me -->
    <div v-if="initialLoading" class="small">Loading…</div>

    <!-- not a provider -->
    <div v-else-if="!isProvider" class="card">
      You are not a provider. Apply to become a provider to add services.
    </div>

    <!-- provider not verified -->
    <div v-else-if="isProvider && !isVerified" class="card">
      Your provider account is pending admin verification. You will be able to add and manage services once verified.
    </div>

    <!-- Provider content -->
    <div v-else>
      <!-- Loading state -->
      <div v-if="loading" class="small">Loading services…</div>

      <!-- Empty state -->
      <div v-else-if="services.length === 0" class="empty">
        You have not added any services yet.
      </div>

      <!-- Services grid -->
      <div v-else class="grid">
        <div v-for="s in services" :key="s._id" class="card svc-card">
          <div class="svc-main">
            <h3 class="svc-title">{{ s.title }}</h3>
            <div class="muted">₹{{ s.price }}</div>
            <div class="desc">{{ truncate(s.description, 140) }}</div>
          </div>

          <!-- Use ProviderActions component for edit/delete UI -->
          <ProviderActions
            :service="s"
            :deleting="loadingById[s._id]"
            @delete="deleteService"
          />
        </div>
      </div>
    </div>

    <div v-if="error" class="error small" style="color:crimson; margin-top:8px">
      {{ error }}
    </div>
  </div>
</template>


<script setup>
import { ref, onMounted, computed, watch } from "vue";
import { useAuthStore } from "../stores/auth";
import api from "../utils/api";
import ProviderActions from "../components/ProviderActions.vue";
import { useRouter } from "vue-router";

const auth = useAuthStore();
const router = useRouter();

const initialLoading = ref(true); // loading auth state
const loading = ref(false); // loading services
const services = ref([]);
const error = ref("");
const loadingById = ref({}); // map id -> boolean for per-row actions

// ensure auth.user is present; if not, fetchMe
async function ensureAuthUser() {
  if (!auth.user) {
    try {
      await auth.fetchMe();
    } catch (e) {
      // not logged in — not necessarily an error here
    }
  }
}

// derived reactivity
const isProvider = computed(() => !!(auth.user && auth.user.role === "provider"));
const isVerified = computed(() => !!(auth.user && auth.user.isVerified));

// truncate helper
function truncate(s = "", n = 120) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

// load provider's services via /api/services/mine
async function load() {
  loading.value = true;
  error.value = "";
  try {
    const res = await api.get("/services/mine");
    const body = res.body ?? res;
    services.value = Array.isArray(body) ? body : (body.items ?? body);
  } catch (err) {
    const status = err?.status;
    if (status === 401) {
      router.push({ path: "/login", query: { redirect: "/my-services" } });
      return;
    }
    error.value = err?.body?.error || err?.message || "Failed to load services";
    services.value = [];
  } finally {
    loading.value = false;
  }
}

// delete service by id (used by ProviderActions)
async function deleteService(id) {
  if (!id) return;
  if (loadingById.value[id]) return; // avoid duplicate deletes

  loadingById.value = { ...loadingById.value, [id]: true };
  const prev = [...services.value];
  services.value = services.value.filter((s) => s._id !== id);

  try {
    await api.del(`/services/${id}`);
  } catch (err) {
    // rollback
    services.value = prev;
    if (err?.status === 401) {
      router.push({ path: "/login", query: { redirect: "/my-services" } });
      return;
    }
    error.value = err?.body?.error || err?.message || "Failed to delete service";
  } finally {
    loadingById.value = { ...loadingById.value, [id]: false };
  }
}

// confirm, then call deleteService
function confirmDelete(sOrId) {
  let id = null;
  let title = "this service";

  if (typeof sOrId === "string") {
    id = sOrId;
    const svc = services.value.find((x) => x._id === id);
    if (svc) title = svc.title;
  } else if (sOrId && typeof sOrId === "object") {
    id = sOrId._id;
    title = sOrId.title || title;
  }

  if (!id) return;
  const ok = confirm(`Delete service "${title}"? This cannot be undone.`);
  if (!ok) return;

  deleteService(id);
}

// initial mount
onMounted(async () => {
  initialLoading.value = true;
  await ensureAuthUser();
  if (auth.user && auth.user.role === "provider" && !auth.user.isVerified) {
    initialLoading.value = false;
    return;
  }
  if (auth.user && auth.user.role === "provider") {
    await load();
  }
  initialLoading.value = false;
});

// reload when auth.user changes
watch(
  () => auth.user,
  (v) => {
    if (!v) {
      services.value = [];
      return;
    }
    if (v.role === "provider" && v.isVerified) {
      load().catch(console.error);
    } else {
      services.value = [];
    }
  },
  { deep: true }
);
</script>

<style scoped>
.page {
  padding: 24px;
  max-width: 1000px;
  margin: 0 auto;
}
.header-row {
  display:flex;
  align-items:center;
  gap:12px;
  justify-content:space-between;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
  margin-top: 16px;
}
.card {
  background: white;
  padding: 16px;
  border-radius: 10px;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.05);
}
.svc-card { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; padding:12px; }
.svc-main { flex:1; min-width:0; }
.svc-title { margin:0 0 6px 0; font-size:18px; }
.muted { color: #6b7280; font-size: 14px; margin-top:4px; }
.desc { color:#374151; margin-top:8px; font-size:14px; }
.svc-actions { display:flex; gap:8px; align-items:center; }
.btn { background:#2563eb; color:white; padding:8px 10px; border-radius:8px; border:none; cursor:pointer; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; }
.btn.small { padding:6px 8px; font-size:13px; }
.btn.secondary { background:transparent; border:1px solid #e6eef8; color:#0f1724; }
.btn.danger { background:#ef4444; color:white; }
.empty { margin-top: 20px; font-size: 14px; color: #6b7280; }
.small { font-size: 13px; }
.error { color: #b91c1c; }
</style>
