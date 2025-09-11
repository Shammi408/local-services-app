<template>
  <div class="page">
    <div class="header-row">
      <div>
        <h1>Admin Dashboard</h1>
        <div class="small muted">Site analytics & management</div>
      </div>
      <div class="actions">
        <button class="btn" @click="refresh">Refresh</button>
      </div>
    </div>

    <div v-if="loading" class="card">Loading…</div>
    <div v-else-if="error" class="card" style="color:crimson">{{ error }}</div>
    <div v-else>
      <div class="grid stats-grid">
        <div class="card stat">
          <div class="muted small">Users</div>
          <div class="big">{{ stats.usersCount }}</div>
        </div>

        <div class="card stat">
          <div class="muted small">Providers</div>
          <div class="big">{{ stats.providersCount }}</div>
        </div>

        <div class="card stat">
          <div class="muted small">Services</div>
          <div class="big">{{ stats.servicesCount }}</div>
        </div>

        <div class="card stat">
          <div class="muted small">Bookings</div>
          <div class="big">{{ stats.bookingsCount }}</div>
        </div>
      </div>

      <div style="margin-top:18px" class="grid two-col">
        <div class="card">
          <h3>Bookings — last 30 days</h3>
          <canvas ref="bookingsChart" height="140"></canvas>
        </div>

        <div class="card">
          <h3>User roles</h3>
          <canvas ref="rolesChart" height="140"></canvas>
        </div>
      </div>

      <hr style="margin:18px 0;" />

      <div class="grid management-grid">
        <div class="card">
          <h3>Users</h3>
          <div class="small muted">Search + verify providers</div>
          <div style="margin-top:8px">
            <input class="input" v-model="userQuery" placeholder="Search name or email" @keyup.enter="loadUsers" />
            <select v-model="userRoleFilter">
              <option value="">All roles</option>
              <option value="user">User</option>
              <option value="provider">Provider</option>
              <option value="admin">Admin</option>
            </select>
            <button class="btn" @click="loadUsers">Search</button>
          </div>

          <div v-if="usersLoading" class="small">Loading users…</div>
          <div v-else>
            <table class="table">
              <thead>
                <tr><th>Name</th><th>Email</th><th>Role</th><th>Verified</th><th>Actions</th></tr>
              </thead>
              <tbody>
                <tr v-for="u in users" :key="u._id ?? u.id">
                  <td>{{ u.name }}</td>
                  <td>{{ u.email }}</td>
                  <td>{{ u.role }}</td>
                  <td>{{ u.isVerified ? 'Yes' : 'No' }}</td>
                  <td>
                    <button v-if="u.role === 'provider' && !u.isVerified" class="btn" @click="verifyUser(u._id || u.id)">Verify</button>
                    <button class="btn secondary" @click="deleteUser(u._id || u.id)">Delete</button>
                  </td>
                </tr>
              </tbody>
            </table>
            <div class="small muted">Showing {{ users.length }} users</div>
          </div>
        </div>

        <div class="card">
          <h3>Services</h3>
          <div class="small muted">Search & remove problematic services</div>
          <div style="margin-top:8px">
            <input class="input" v-model="svcQuery" placeholder="Search services..." @keyup.enter="loadServices" />
            <button class="btn" @click="loadServices">Search</button>
          </div>

          <div v-if="servicesLoading" class="small">Loading services…</div>
          <div v-else>
            <div v-for="s in services" :key="s._id ?? s.id" class="svc-row">
              <div>
                <div style="font-weight:700">{{ s.title }}</div>
                <div class="small muted">By: {{ s.providerId?.name || '—' }}</div>
                <div class="small muted">₹{{ s.price ?? '-' }}</div>
              </div>
              <div>
                <button class="btn secondary" @click="deleteService(s._id || s.id)">Delete</button>
              </div>
            </div>
            <div class="small muted">Showing {{ services.length }} services</div>
          </div>
        </div>
      </div>

      <hr style="margin:18px 0;" />

      <div class="card">
        <h3>Recent bookings</h3>
        <div v-if="bookingsLoading" class="small">Loading…</div>
        <div v-else>
          <table class="table">
            <thead><tr><th>ID</th><th>Service</th><th>User</th><th>Provider</th><th>Date</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>
              <tr v-for="b in bookings" :key="b._id ?? b.id">
                <td>{{ b._id ?? b.id }}</td>
                <td>{{ b.serviceId?.title || '—' }}</td>
                <td>{{ b.userId?.name || '—' }}</td>
                <td>{{ b.providerId?.name || '—' }}</td>
                <td>{{ formatDate(b.date) }}</td>
                <td>{{ b.status }}</td>
                <td>
                  <select v-model="adminStatusMap[b._id ?? b.id]">
                    <option value="">—</option>
                    <option value="pending">pending</option>
                    <option value="confirmed">confirmed</option>
                    <option value="completed">completed</option>
                    <option value="cancelled">cancelled</option>
                  </select>
                  <button class="btn" @click="changeBookingStatus(b._id ?? b.id)">Set</button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from "vue";
import api from "../utils/api";
import Chart from "chart.js/auto";
import { useAuthStore } from "../stores/auth";
import { useRouter } from "vue-router";

const auth = useAuthStore();
const router = useRouter();

const stats = ref({});
const users = ref([]);
const services = ref([]);
const bookings = ref([]);

const loading = ref(false);
const error = ref("");

const usersLoading = ref(false);
const servicesLoading = ref(false);
const bookingsLoading = ref(false);

const userQuery = ref("");
const userRoleFilter = ref("");
const svcQuery = ref("");

const adminStatusMap = ref({});

const bookingsChartRef = ref(null);
const rolesChartRef = ref(null);
let bookingsChart = null;
let rolesChart = null;

function formatDate(d) {
  try { return new Date(d).toLocaleString(); } catch { return d; }
}

async function loadStats() {
  const res = await api.get("/admin/stats");
  stats.value = res.body ?? res;
}

async function loadUsers() {
  usersLoading.value = true;
  try {
    const q = userQuery.value ? `?q=${encodeURIComponent(userQuery.value)}&role=${encodeURIComponent(userRoleFilter.value || "")}` : `?role=${encodeURIComponent(userRoleFilter.value || "")}`;
    const res = await api.get(`/admin/users${q}`);
    const body = res.body ?? res;
    users.value = body.items ?? body;
  } catch (err) {
    console.error("loadUsers", err);
  } finally { usersLoading.value = false; }
}

async function verifyUser(id) {
  try {
    await api.put(`/admin/users/${id}/verify`, { isVerified: true });
    await loadUsers();
  } catch (err) { alert("Failed to verify user: " + (err?.message || err?.body?.error)); }
}

async function deleteUser(id) {
  if (!confirm("Delete this user? This is irreversible.")) return;
  try {
    await api.del(`/admin/users/${id}`);
    await loadUsers();
  } catch (err) { alert("Failed to delete user"); }
}

async function loadServices() {
  servicesLoading.value = true;
  try {
    const q = svcQuery.value ? `?q=${encodeURIComponent(svcQuery.value)}` : "";
    const res = await api.get(`/admin/services${q}`);
    const body = res.body ?? res;
    services.value = body.items ?? body;
  } catch (err) {
    console.error("loadServices", err);
  } finally { servicesLoading.value = false; }
}

async function deleteService(id) {
  if (!confirm("Delete this service?")) return;
  try {
    await api.del(`/admin/services/${id}`);
    await loadServices();
  } catch (err) { alert("Failed to delete service"); }
}

async function loadBookings() {
  bookingsLoading.value = true;
  try {
    const res = await api.get("/admin/bookings?limit=50");
    const body = res.body ?? res;
    bookings.value = body.items ?? body;
    bookings.value.forEach(b => adminStatusMap.value[b._id ?? b.id] = b.status);
  } catch (err) {
    console.error("loadBookings", err);
  } finally { bookingsLoading.value = false; }
}

async function changeBookingStatus(id) {
  const newStatus = adminStatusMap.value[id];
  if (!newStatus) return alert("Select a status");
  try {
    await api.put(`/admin/bookings/${id}/status`, { status: newStatus });
    await loadBookings();
    await loadStats();
  } catch (err) {
    alert("Failed to update status");
  }
}

function renderBookingsChart(series) {
  const ctx = bookingsChartRef.value?.getContext?.("2d");
  if (!ctx) return;
  const labels = series.map(s => s.day);
  const data = series.map(s => s.count);

  if (bookingsChart) bookingsChart.destroy();
  bookingsChart = new Chart(ctx, {
    type: "line",
    data: { labels, datasets: [{ label: "Bookings", data, fill: true, tension: 0.3 }] },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

function renderRolesChart(roles) {
  const ctx = rolesChartRef.value?.getContext?.("2d");
  if (!ctx) return;
  const labels = roles.map(r => r.role);
  const data = roles.map(r => r.count);

  if (rolesChart) rolesChart.destroy();
  rolesChart = new Chart(ctx, {
    type: "doughnut",
    data: { labels, datasets: [{ data }] },
    options: { responsive: true, maintainAspectRatio: false }
  });
}

async function loadAll() {
  loading.value = true;
  error.value = "";
  try {
    await loadStats();
    await loadUsers();
    await loadServices();
    await loadBookings();

    // render charts after DOM updated
    await nextTick();
    renderBookingsChart(stats.value.bookingsSeries || []);
    renderRolesChart(stats.value.userRoles || []);
  } catch (err) {
    console.error("Admin loadAll error:", err);
    error.value = err?.message || "Failed to load admin data";
  } finally {
    loading.value = false;
  }
}

function refresh() {
  loadAll();
}

onMounted(async () => {
  // guard for admin role (extra safe)
  if (!auth.user) {
    try { await auth.fetchMe(); } catch (e) {}
  }
  if (!auth.user || auth.user.role !== "admin") {
    router.push("/");
    return;
  }
  await loadAll();
});
</script>

<style scoped>
.page { max-width:1200px; margin:0 auto; padding:20px; }
.header-row { display:flex; justify-content:space-between; align-items:center; gap:12px; margin-bottom:12px; }
.small { font-size:13px; color:#6b7280; }
.muted { color:#9aa2b2; }
.card { padding:12px; border-radius:10px; background:white; box-shadow:0 6px 18px rgba(2,6,23,0.04); }
.stats-grid { display:grid; grid-template-columns: repeat(auto-fit,minmax(180px,1fr)); gap:12px; }
.big { font-weight:700; font-size:22px; margin-top:8px; }
.grid.two-col { display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-top:12px; }
.management-grid { display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-top:12px; }
.input { padding:8px; border:1px solid #e6eef8; border-radius:8px; margin-right:8px; }
.table { width:100%; border-collapse:collapse; margin-top:12px; }
.table th, .table td { text-align:left; padding:8px 6px; border-bottom:1px solid rgba(0,0,0,0.04); }
.svc-row { display:flex; justify-content:space-between; gap:12px; padding:8px 0; border-bottom:1px solid rgba(0,0,0,0.04); }
.btn { background:#2563eb;color:white;border:none;padding:8px 10px;border-radius:8px; cursor:pointer; }
.btn.secondary { background:transparent;color:#0f1724;border:1px solid rgba(0,0,0,0.06); padding:6px 8px; }
</style>
