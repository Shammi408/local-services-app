<template>
  <div class="page">
    <div class="flex" style="justify-content:space-between;align-items:center;margin-bottom:12px;">
      <h1>My Services</h1>
      <router-link to="/services/new" class="btn">Add Service</router-link>
    </div>

    <div v-if="loading" class="card">Loading services…</div>
    <div v-else-if="error" class="card" style="color:crimson">{{ error }}</div>
    <div v-else>
      <div v-if="services.length === 0" class="card">You have not added any services yet.</div>

      <div class="grid">
        <div v-for="s in services" :key="s._id" class="card">
          <div class="small muted">ID: {{ s._id }}</div>
          <h3>{{ s.title || s.name }}</h3>
          <div class="small">{{ s.description }}</div>
          <div style="margin-top:10px">
            <router-link :to="`/services/${s._id}/edit`" class="btn secondary">Edit</router-link>
            <button class="btn" @click="toggleAvailability(s)">{{ s.isAvailable ? 'Disable' : 'Enable' }}</button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import api from "../utils/api";

const services = ref([]);
const loading = ref(false);
const error = ref("");

async function loadServices() {
  loading.value = true;
  error.value = "";
  try {
    // backend endpoint to fetch provider's services (adjust if yours differs)
    const res = await api.get("/providers/me/services");
    services.value = res.body || [];
  } catch (err) {
    error.value = err?.message || "Failed to load services";
  } finally {
    loading.value = false;
  }
}

async function toggleAvailability(svc) {
  try {
    await api.patch(`/services/${svc._id}`, { isAvailable: !svc.isAvailable });
    await loadServices();
  } catch (err) {
    alert("Failed to update: " + (err?.message || ""));
  }
}

onMounted(() => loadServices());
</script>

<style scoped>
.page { padding: 20px; }
.grid { display:grid; grid-template-columns: repeat(auto-fill,minmax(260px,1fr)); gap:16px; }
.card { padding:12px; border-radius:8px; background:white; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.btn { background:#2563eb;color:#fff;padding:6px 10px;border-radius:6px;border:none; cursor:pointer; }
.btn.secondary { background:transparent;color:#333;border:1px solid rgba(0,0,0,0.08); margin-right:8px; }
.small { font-size:13px; color:#555; }
.muted { color:#888; }
.flex { display:flex; }
</style>
