<template>
  <div class="page">
    <div class="header-row">
      <div>
        <h1>Provider Dashboard</h1>
        <div class="small muted">Overview of your services & bookings</div>
      </div>

      <div class="actions">
        <button class="btn secondary" @click="exportPDF">Export PDF</button>

        <router-link to="/services/new" class="btn">Add Service</router-link>
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
        <div class="card stat">
          <div class="muted small">Total earnings</div>
          <div class="big">₹{{ totalEarnings ?? "0.00" }}</div>
        </div>
      </div>

      <!-- Charts -->
      <div class="grid two-col" style="margin-top:16px">
        <div class="card" style="position:relative; min-height:220px;">
          <h3>Bookings — last 30 days</h3>
          <canvas ref="bookingsChartRef" style="width:100%; display:block; height:220px; min-height:220px;"></canvas>
        </div>

        <div class="card" style="position:relative; min-height:220px;">
          <h3>Revenue — last 30 days</h3>
          <canvas ref="revenueChartRef" style="width:100%; display:block; height:220px; min-height:220px;"></canvas>
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
              <div class="small">Amount: ₹{{ (b.amount ?? b.servicePrice ?? 0) }}</div>
              <div class="small">Payment: <strong>{{ b.paid ? 'Paid' : 'Unpaid' }}</strong></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from "vue";
import api from "../utils/api";
import Chart from "chart.js/auto";
import { useAuthStore } from "../stores/auth";
import { useRouter } from "vue-router";
import { useBookingsStore } from "../stores/bookings";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";

const auth = useAuthStore();
const router = useRouter();
const bookingsStore = useBookingsStore();

const servicesCount = ref(0);
const totalEarnings = ref("0.00");
const loading = ref(false);
const error = ref("");
const providerStats = ref({});

// chart refs
const bookingsChartRef = ref(null);
const revenueChartRef = ref(null);
let bookingsChart = null;
let revenueChart = null;

function prettyDate(v) {
  if (!v) return "-";
  const d = new Date(v);
  return d.toLocaleString();
}

const upcomingCount = computed(() => bookingsStore.items.length);

const recentBookings = computed(() =>
  bookingsStore.items.slice(0, 8).map((b) => ({
    _id: b._id ?? b.id,
    serviceTitle:
      (b.serviceId && (b.serviceId.title || b.serviceId.name)) ||
      b.serviceName ||
      "Service",
    customerName:
      (b.userId && (b.userId.name || b.userId.fullName)) ||
      b.customerName ||
      "Customer",
    date: b.date ?? b.scheduledAt ?? b.createdAt,
    status: b.status,
    paid: b.paid,
    amount: b.serviceId?.price ?? 0,
  }))
);

function computeEarnings() {
  try {
    const paidBookings = (bookingsStore.items || []).filter(
      (b) => b.paid === true || b.paid === "true"
    );
    let totalPaise = 0;
    for (const b of paidBookings) {
      if (b.payment && b.payment.amount) totalPaise += Number(b.payment.amount) || 0;
      else if (b.serviceId?.price) totalPaise += Math.round(Number(b.serviceId.price) * 100) || 0;
      else if (b.amount) totalPaise += Number(b.amount) || 0;
    }
    totalEarnings.value = (totalPaise / 100).toFixed(2);
  } catch {
    totalEarnings.value = "0.00";
  }
}

/* chart helpers */
function renderBookingsChart(series) {
  const ctx = bookingsChartRef.value?.getContext("2d");
  if (!ctx) return;
  const labels = (series || []).map((s) => (s.day || "").slice(5));
  const data = (series || []).map((s) => s.count ?? 0);
  if (bookingsChart) bookingsChart.destroy();
  bookingsChart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets: [{ label: "Bookings", data, tension: 0.25, fill: true }] },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

function renderRevenueChart(series) {
  const ctx = revenueChartRef.value?.getContext("2d");
  if (!ctx) return;
  const labels = (series || []).map((s) => (s.day || "").slice(5));
  const data = (series || []).map((s) => (s.amountPaise ?? 0) / 100);
  if (revenueChart) revenueChart.destroy();
  revenueChart = new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ label: "Revenue (₹)", data }] },
    options: { responsive: true, maintainAspectRatio: false }
  });
}
async function exportPDF() {
  try {
    const element = document.querySelector(".page"); // whole dashboard page
    if (!element) {
      alert("Dashboard not found!");
      return;
    }

    // convert dashboard to canvas
    const canvas = await html2canvas(element, { scale: 2 }); // high-res
    const imgData = canvas.toDataURL("image/png");

    // make PDF
    const pdf = new jsPDF("p", "mm", "a4"); // portrait, A4
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
    pdf.save("dashboard.pdf");
  } catch (err) {
    console.error("PDF export failed:", err);
    alert("Failed to export PDF");
  }
}
/* loader */
async function load() {
  if (!auth.user) {
    try { await auth.fetchMe(); } catch {}
  }
  if (!auth.user) return router.push("/login");
  if (auth.user.role !== "provider") return router.push("/");

  loading.value = true;
  error.value = "";

  try {
    const svcRes = await api.get("/services/mine");
    const svcBody = svcRes.body ?? svcRes;
    servicesCount.value = Array.isArray(svcBody) ? svcBody.length : svcBody.items?.length || 0;

    await bookingsStore.fetchBookings();
    computeEarnings();

    const statsRes = await api.get("/providers/me/stats");
    providerStats.value = statsRes.body ?? statsRes;

    loading.value = false;
    await nextTick();

    renderBookingsChart(providerStats.value.bookingsSeries || []);
    renderRevenueChart(providerStats.value.revenueSeries || []);
  } catch (err) {
    console.error("Dashboard load error", err);
    error.value = err?.body?.error || err?.message || "Failed to load dashboard";
    loading.value = false;
  }
}

onMounted(load);
</script>

<style scoped>
.page {
  padding: 20px;
  max-width: var(--container-width, 1100px);
  margin: 0 auto;
  box-sizing: border-box;
}

.header-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.actions {
  display: flex;
  gap: 8px;
}

.small {
  font-size: 13px;
  color: var(--muted, #9aa2b2);
}

.muted {
  color: var(--muted, #9aa2b2);
}

.card {
  padding: 12px;
  background: white;
  border-radius: 10px;
  box-shadow: 0 6px 18px rgba(2, 6, 23, 0.04);
  box-sizing: border-box;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 12px;
}

.stat .big {
  font-size: 22px;
  font-weight: 700;
  margin-top: 6px;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
}

.two-col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.btn {
  padding: 6px 10px;
  border-radius: 8px;
  background: #2563eb;
  color: white;
  text-decoration: none;
  border: none;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn.secondary {
  background: transparent;
  border: 1px solid rgba(0, 0, 0, 0.06);
  color: var(--text, #0f1724);
  padding: 6px 10px;
  border-radius: 8px;
}

/* chart safety clamp */
.card canvas {
  width: 100% !important;
  max-width: 100% !important;
  height: auto !important;
  max-height: 420px !important;
  display: block;
}

/* responsive tweaks */
@media (max-width: 760px) {
  .two-col { grid-template-columns: 1fr; }
  .grid { grid-template-columns: 1fr; }
  .header-row { flex-direction: column; align-items: stretch; gap: 10px; }
  .actions { justify-content: flex-end; }
}
</style>
