<template>
  <div class="page">
    <div v-if="loading" class="card small">Loading service…</div>

    <div v-else-if="error" class="card" style="color:crimson">{{ error }}</div>

    <div v-else-if="!service" class="card">Service not found.</div>

    <div v-else class="card">
      <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:12px;">
        <div>
          <h1>{{ service.title }}</h1>
          <div class="small muted">by
            <router-link
              v-if="providerId"
              :to="`/profile/${providerId}`"
            >
              {{ providerName }}
            </router-link>
            <span v-else class="muted">Unknown</span>
          </div>

          <p style="margin-top:12px">{{ service.description }}</p>
        </div>

        <div style="text-align:right">
          <div class="small muted">Price</div>
          <div style="font-weight:700; margin-bottom:8px">₹{{ service.price ?? "-" }}</div>
          <router-link :to="`/services/${service._id}/book`" class="btn">Book</router-link>
        </div>
      </div>

      <hr style="margin:16px 0;" />

      <div class="small muted">Category: {{ service.category ?? "—" }}</div>
      <div class="small muted">Available: {{ service.isAvailable ? "Yes" : "No" }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useServicesStore } from "../stores/service"; // your store file is services.js
// import api if you prefer raw requests: import api from "../utils/api";

const route = useRoute();
const router = useRouter();
const store = useServicesStore();

const id = route.params.id;

const loading = ref(true);
const error = ref("");
const service = ref(null);

const providerId = computed(() => {
  if (!service.value) return null;
  const p = service.value.providerId ?? service.value.provider;
  if (!p) return null;
  return typeof p === "string" ? p : (p._id ?? p.id ?? null);
});
const providerName = computed(() => {
  if (!service.value) return "";
  const p = service.value.providerId ?? service.value.provider;
  return typeof p === "string" ? "provider" : (p?.name ?? "provider");
});

async function load() {
  loading.value = true;
  error.value = "";
  service.value = null;
  try {
    // Prefer store.fetchService since you already have it
    const s = await store.fetchService(id);
    // store.fetchService sets store.current. We return it to local `service`
    service.value = s ?? store.current ?? null;
  } catch (err) {
    console.error("Failed loading service:", err);
    error.value = err?.message || err?.body?.error || "Failed to load service";
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  if (!id) {
    error.value = "Invalid service id";
    loading.value = false;
    return;
  }
  load();
});
</script>

<style scoped>
.page { padding: 20px; }
.card { background: white; padding: 16px; border-radius: 8px; box-shadow: 0 3px 12px rgba(0,0,0,0.06); }
.small { font-size:13px; color:#6b7280; }
.muted { color:#6b7280; }
.btn { background:#2563eb; color:#fff; padding:6px 10px; border-radius:6px; text-decoration:none; display:inline-block; }
</style>
