<template>
  <div class="page">
    <div class="flex header" style="justify-content:space-between;align-items:center;margin-bottom:12px;">
      <h1>My Services</h1>
      <router-link to="/services/new" class="btn">Add Service</router-link>
    </div>

    <div v-if="loading" class="card">Loading services…</div>
    <div v-else-if="error" class="card" style="color:crimson">{{ error }}</div>
    <div v-else>
      <div v-if="services.length === 0" class="card">You have not added any services yet.</div>

      <div class="grid">
        <div
          v-for="s in services"
          :key="s._id"
          :class="['card svc-card', { disabled: !s.isAvailable }]"
        >
          <div class="row top">
            <div>
              <!-- <div class="small muted">ID: {{ s._id }}</div> -->
              <h3 class="svc-title">{{ s.title || s.name }}</h3>
            </div>
            <div class="status">
              <span v-if="!s.isAvailable" class="badge disabled-badge">Disabled</span>
            </div>
          </div>

          <div class="desc small">{{ s.description }}</div>

          <div style="margin-top:12px; display:flex; gap:8px; align-items:center;">
            <router-link :to="`/services/${s._id}/edit`" class="btn secondary">Edit</router-link>

            <!-- If available -> show Disable button -->
            <button v-if="s.isAvailable" class="btn warn" @click="confirmToggle(s)">
              Disable
            </button>

            <!-- If disabled -> show Make active + Delete forever -->
            <div v-else style="display:flex; gap:8px;">
              <button class="btn" @click="confirmToggle(s)">Make active</button>
              <button class="btn danger" @click="confirmDelete(s)">Delete forever</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- small confirm modal (simple) -->
    <div v-if="confirmVisible" class="modal-backdrop" @click.self="closeConfirm">
      <div class="modal-card">
        <h3>{{ confirmTitle }}</h3>
        <p style="margin-top:8px">{{ confirmMessage }}</p>
        <div style="margin-top:12px; display:flex; gap:8px; justify-content:flex-end;">
          <button class="btn secondary" @click="closeConfirm">Cancel</button>
          <button class="btn" :class="confirmAction === 'delete' ? 'danger' : 'warn'" @click="runConfirmAction">
            {{ confirmAction === 'delete' ? 'Delete forever' : (confirmAction === 'enable' ? 'Make active' : 'Confirm') }}
          </button>
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

// simple confirm modal state
const confirmVisible = ref(false);
const confirmTarget = ref(null);
const confirmAction = ref(""); // 'enable' | 'disable' | 'delete'
const confirmTitle = ref("");
const confirmMessage = ref("");

async function loadServices() {
  loading.value = true;
  error.value = "";
  try {
    // adjust to your endpoint: /services/mine or /providers/me/services
    // You earlier used /providers/me/services; keep that if it's correct.
    const res = await api.get("/providers/me/services");
    services.value = (res.body ?? res) || [];
  } catch (err) {
    console.error("Failed to load provider services", err);
    error.value = err?.body?.error || err?.message || "Failed to load services";
  } finally {
    loading.value = false;
  }
}

function confirmToggle(svc) {
  confirmTarget.value = svc;
  if (svc.isAvailable) {
    confirmAction.value = "disable";
    confirmTitle.value = "Disable service?";
    confirmMessage.value = `Are you sure you want to disable "${svc.title || svc.name}"? It will not appear in public listings.`;
  } else {
    confirmAction.value = "enable";
    confirmTitle.value = "Make service active?";
    confirmMessage.value = `Re-activate "${svc.title || svc.name}" so customers can book it again.`;
  }
  confirmVisible.value = true;
}

function confirmDelete(svc) {
  confirmTarget.value = svc;
  confirmAction.value = "delete";
  confirmTitle.value = "Delete service forever?";
  confirmMessage.value = `This will permanently delete "${svc.title || svc.name}". This action cannot be undone.`;
  confirmVisible.value = true;
}

function closeConfirm() {
  confirmVisible.value = false;
  confirmTarget.value = null;
  confirmAction.value = "";
  confirmTitle.value = "";
  confirmMessage.value = "";
}

async function runConfirmAction() {
  if (!confirmTarget.value) return closeConfirm();

  const svc = confirmTarget.value;
  try {
    if (confirmAction.value === "delete") {
      // delete
      await api.del(`/services/${svc._id}`);
      // remove locally
      services.value = services.value.filter(x => x._id !== svc._id);
    } else if (confirmAction.value === "disable" || confirmAction.value === "enable") {
      // patch isAvailable
      const newVal = confirmAction.value === "enable";
      await api.patch(`/services/${svc._id}`, { isAvailable: newVal });
      // reload list (safer) — could be optimized to update locally
      await loadServices();
    }
  } catch (err) {
    console.error("Confirm action failed", err);
    alert("Operation failed: " + (err?.body?.error || err?.message || err));
  } finally {
    closeConfirm();
  }
}

onMounted(() => loadServices());
</script>

<style scoped>
.page { padding: 20px; }
.header { align-items:center; }

/* grid: 4 across on large screens, 2 on medium, 1 on small */
.grid {
  display:grid;
  grid-template-columns: repeat(4, 1fr);
  gap:16px;
}
@media (max-width:1200px) {
  .grid { grid-template-columns: repeat(3, 1fr); }
}
@media (max-width:900px) {
  .grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width:560px) {
  .grid { grid-template-columns: repeat(1, 1fr); }
}

.card { padding:12px; border-radius:8px; background:white; box-shadow: 0 2px 8px rgba(0,0,0,0.06); position: relative; }
.svc-card.disabled { opacity: 0.6; filter: grayscale(0.05); }

/* service top row */
.row.top { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; }
.svc-title { margin:6px 0 0 0; font-size:16px; }

/* small */
.small { font-size:13px; color:#555; }
.muted { color:#888; }

.badge { display:inline-block; padding:6px 8px; border-radius:999px; background:#f3f4f6; color:#374151; font-size:12px; }
.disabled-badge { background:#fee2e2; color:#991b1b; }

/* buttons */
.btn { background:#2563eb;color:#fff;padding:6px 10px;border-radius:6px;border:none; cursor:pointer; }
.btn.secondary { background:transparent;color:#333;border:1px solid rgba(0,0,0,0.08); }
.btn.warn { background:#f59e0b; color:#fff; }
.btn.danger { background:#dc2626; color:white; }

/* modal */
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.35);
  display:flex;
  align-items:center;
  justify-content:center;
  z-index: 1200;
}
.modal-card {
  background: white;
  padding: 18px;
  border-radius: 8px;
  width: 420px;
  max-width: 92%;
  box-shadow: 0 10px 30px rgba(0,0,0,0.2);
}
</style>
