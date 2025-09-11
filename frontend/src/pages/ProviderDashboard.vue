<template>
  <div class="page">
    <div class="header-row">
      <div>
        <h1>Provider Dashboard</h1>
        <div class="small muted">Overview of your services & bookings</div>
      </div>

      <div class="actions">
        <router-link to="/services/new" class="btn secondary">Add Service</router-link>
        <router-link to="/provider/services" class="btn">My Services</router-link>
        <router-link to="/provider/bookings" class="btn">Upcoming Bookings</router-link>
      </div>
    </div>

    <div v-if="loading" class="card">Loading dashboard…</div>
    <div v-else-if="error" class="card" style="color:crimson">{{ error }}</div>
    <div v-else>
      <div class="grid stats-grid">
        <div class="card stat">
          <div class="muted small">Total services</div>
          <div class="big">{{ servicesCount }}</div>
        </div>

        <div class="card stat">
          <div class="muted small">Upcoming bookings</div>
          <div class="big">{{ upcomingCount }}</div>
        </div>

        <div class="card stat">
          <div class="muted small">Recent bookings</div>
          <div class="big">{{ recentBookings.length }}</div>
        </div>
      </div>

      <div style="margin-top:16px;">
        <h2 style="margin-bottom:8px">Recent bookings</h2>
        <div v-if="recentBookings.length === 0" class="card">No recent bookings</div>
        <div class="grid" v-else>
          <div v-for="b in recentBookings" :key="b._id ?? b.id" class="card">
            <div class="small muted">Booking ID: {{ b._id ?? b.id }}</div>
            <div style="font-weight:700">{{ b.serviceTitle }}</div>
            <div class="small">Customer: {{ b.customerName }}</div>
            <div class="small muted">When: {{ prettyDate(b.date || b.scheduledAt || b.createdAt) }}</div>
            <div style="margin-top:8px">
              <span class="small">Status: </span><strong>{{ b.status }}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import api from "../utils/api";
import { useAuthStore } from "../stores/auth";
import { useRouter } from "vue-router";
import { useBookingsStore } from "../stores/bookings";

const auth = useAuthStore();
const router = useRouter();
const bookingsStore = useBookingsStore();

const servicesCount = ref(0);
const loading = ref(false);
const error = ref("");

// pretty date
function prettyDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  return d.toLocaleString();
}

// upcoming count is reactive to bookingsStore.items
const upcomingCount = computed(() => bookingsStore.items.length);

// compute a "recent bookings" array from bookings store (first 8, map to simple fields)
const recentBookings = computed(() =>
  bookingsStore.items.slice(0, 8).map((b) => ({
    _id: b._id ?? b.id,
    serviceTitle: (b.serviceId && (b.serviceId.title || b.serviceId.name)) || b.serviceName || "Service",
    customerName: (b.userId && (b.userId.name || b.userId.fullName)) || b.customerName || "Customer",
    date: b.date ?? b.scheduledAt ?? b.createdAt,
    status: b.status,
  }))
);

async function load() {
  // Basic role/verified guard (router guard should have prevented this, but double-check)
  if (!auth.user) {
    try {
      await auth.fetchMe();
    } catch (e) {
      // ignore - will redirect below
    }
  }
  if (!auth.user) {
    router.push("/login");
    return;
  }
  if (auth.user.role !== "provider") {
    router.push("/");
    return;
  }

  loading.value = true;
  error.value = "";

  try {
    // 1) load services count for this provider (server endpoint /services/mine exists)
    try {
      const svcRes = await api.get("/services/mine");
      const svcBody = svcRes.body ?? svcRes;
      servicesCount.value = Array.isArray(svcBody) ? svcBody.length : 0;
    } catch (svcErr) {
      // non-fatal: set to 0 and continue
      console.warn("Failed to fetch provider services:", svcErr);
      servicesCount.value = 0;
    }

    // 2) load upcoming bookings into bookingsStore (this will be reactive)
    await bookingsStore.fetchBookings("upcoming");

    // bookingsStore.items now holds the upcoming bookings — recentBookings and upcomingCount computed above read from it
  } catch (err) {
    console.error("Dashboard load error", err);
    error.value = err?.body?.error || err?.message || "Failed to load dashboard";
  } finally {
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.page { padding: 20px; max-width: var(--container-width, 1100px); margin:0 auto; }
.header-row { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:16px; }
.actions { display:flex; gap:8px; }
.small { font-size:13px; color:var(--muted, #9aa2b2); }
.muted { color:var(--muted, #9aa2b2); }
.card { padding:12px; background:white; border-radius:10px; box-shadow:0 6px 18px rgba(2,6,23,0.04); }
.stats-grid { display:grid; grid-template-columns: repeat(auto-fit,minmax(180px,1fr)); gap:12px; }
.stat .big { font-size:22px; font-weight:700; margin-top:6px; }
.grid { display:grid; grid-template-columns: repeat(auto-fill,minmax(280px,1fr)); gap:12px; }
.btn { padding:6px 10px; border-radius:8px; background:#2563eb; color:white; text-decoration:none; }
.btn.secondary { background:transparent; border:1px solid rgba(0,0,0,0.06); color:var(--text, #0f1724); }
</style>
