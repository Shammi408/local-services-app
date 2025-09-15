<template>
  <div class="page">
    <h1>Upcoming Bookings</h1>

    <div v-if="loading" class="card">Loading bookings…</div>
    <div v-else-if="error" class="card" style="color:crimson">{{ error }}</div>
    <div v-else>
      <div v-if="bookings.length === 0" class="card">No upcoming bookings.</div>

      <div class="grid">
        <div v-for="b in bookings" :key="b._id ?? b.id" class="card">
          <div class="small muted">Booking ID: {{ b._id ?? b.id }}</div>
          <h3>{{ (b.serviceId && (b.serviceId.title || b.serviceId.name)) || b.serviceName || 'Service' }}</h3>
          <div class="small">Customer: {{ (b.userId && b.userId.name) || b.customerName || 'Customer' }}</div>
          <div class="small">Date: {{ prettyDate(b.date || b.scheduledAt || b.createdAt) }}</div>
          <div class="small">Status: <strong>{{ b.status }}</strong></div>
          <div class="small">Amount: ₹{{ b.serviceId?.price ?? b.amount ?? '-' }}</div>
          <div class="small">Payment: <strong>{{ b.paid ? 'Paid' : 'Unpaid' }}</strong></div>

          <div style="margin-top:8px">
            <!-- Show Confirm only for pending bookings -->
            <button
              v-if="b.status === 'pending'"
              class="btn"
              @click="updateStatus(b._id ?? b.id, 'confirmed')"
              :disabled="bookingsStore.loadingAction"
            >
              Confirm
            </button>

            <!-- Show Complete action when confirmed (optional) -->
            <button
              v-if="b.status === 'confirmed'"
              class="btn"
              @click="updateStatus(b._id ?? b.id, 'completed')"
              :disabled="bookingsStore.loadingAction"
            >
              Mark complete
            </button>

            <!-- Show Cancel for pending/confirmed only -->
            <button
              v-if="b.status === 'pending' || b.status === 'confirmed'"
              class="btn secondary"
              @click="updateStatus(b._id ?? b.id, 'cancelled')"
              :disabled="bookingsStore.loadingAction"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { onMounted, ref } from "vue";
import { useBookingsStore } from "../stores/bookings";
const bookingsStore = useBookingsStore();

const bookings = ref([]);
const loading = ref(false);
const error = ref("");

function prettyDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  return d.toLocaleString();
}

async function loadBookings() {
  loading.value = true;
  error.value = "";
  try {
    // fetch upcoming bookings for provider (backend filters by req.user.role)
    const items = await bookingsStore.fetchBookings("upcoming");
    bookings.value = items;
  } catch (err) {
    console.error("Failed to load provider bookings:", err);
    error.value = err?.body?.error || err?.message || "Failed to load bookings";
  } finally {
    loading.value = false;
  }
}

async function updateStatus(id, status) {
  try {
    await bookingsStore.updateStatus(id, status);
    // bookingsStore.updateStatus will replace the item in the store.
    // Re-run fetch to ensure list reflects filtering rules (e.g. status changed).
    await loadBookings();
  } catch (err) {
    alert("Failed to update status: " + (err?.message || err?.body?.error || ""));
  }
}

onMounted(() => {
  loadBookings();
});
</script>

<style scoped>
/* keep your styles — same as before */
.page { padding: 20px; }
.grid { display:grid; grid-template-columns: repeat(auto-fill,minmax(280px,1fr)); gap:16px; }
.card { padding:12px; border-radius:8px; background:white; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.btn { background:#2563eb;color:#fff;padding:6px 10px;border-radius:6px;border:none; cursor:pointer; }
.btn.secondary { background:transparent;color:#333;border:1px solid rgba(0,0,0,0.08); }
.small { font-size:13px; color:#555; }
.muted { color:#888; }
</style>
