<template>
  <div class="page">
    <h1>My Bookings</h1>

    <div v-if="bookings.loading" class="small">Loading…</div>
    <div v-else>
      <div v-if="bookings.items.length === 0" class="empty">No bookings yet.</div>

      <div class="list">
        <div v-for="b in bookings.items" :key="b._id" class="card booking-row">
          <div class="left">
            <h3>{{ b.serviceId?.title || "Service" }}</h3>
            <div class="small muted">On: {{ formatDate(b.date) }}</div>
            <div class="small muted">By: {{ b.providerId?.name || "Provider" }}</div>
            <div style="margin-top:6px;">
              <span class="status-badge" :class="statusClass(b.status)">{{ b.status }}</span>
            </div>
          </div>

          <div class="right">
            <!-- User (owner) can cancel (if not already cancelled/completed) -->
            <button
              v-if="isOwner(b) && canCancel(b)"
              class="btn"
              @click="confirmAndChange(b, 'cancelled')"
              :disabled="bookings.loadingAction"
            >
              Cancel
            </button>

            <!-- Provider actions -->
            <div v-else-if="isProvider(b)">
              <button
                v-if="b.status === 'pending'"
                class="btn"
                @click="confirmAndChange(b, 'confirmed')"
                :disabled="bookings.loadingAction"
              >
                Confirm
              </button>

              <button
                v-if="b.status === 'confirmed'"
                class="btn"
                @click="confirmAndChange(b, 'completed')"
                :disabled="bookings.loadingAction"
              >
                Mark complete
              </button>

              <!-- provider can also cancel if needed -->
              <button
                v-if="b.status !== 'cancelled' && b.status !== 'completed'"
                class="btn secondary"
                @click="confirmAndChange(b, 'cancelled')"
                :disabled="bookings.loadingAction"
              >
                Cancel
              </button>
            </div>

            <!-- If neither owner nor provider (admin or others), no actions -->
          </div>
        </div>
      </div>
    </div>

    <div v-if="bookings.error" class="small" style="color:crimson; margin-top:12px">{{ bookings.error }}</div>
  </div>
</template>

<script setup>
import { onMounted } from "vue";
import { useBookingsStore } from "../stores/bookings";
import { useAuthStore } from "../stores/auth";

const bookings = useBookingsStore();
const auth = useAuthStore();

function formatDate(dt) {
  try {
    return new Date(dt).toLocaleString();
  } catch {
    return dt;
  }
}

function isOwner(b) {
  const uid = auth.user?.id ?? auth.user?._id;
  const bUser = b.userId?._id ?? b.userId;
  return uid && bUser && uid.toString() === bUser.toString();
}
function isProvider(b) {
  const uid = auth.user?.id ?? auth.user?._id;
  const bProv = b.providerId?._id ?? b.providerId;
  return uid && bProv && uid.toString() === bProv.toString();
}

function canCancel(b) {
  // users can cancel only pending/confirmed (not completed or already cancelled)
  return b.status !== "completed" && b.status !== "cancelled";
}

function statusClass(status) {
  // helper for badge classes
  return {
    pending: "badge-pending",
    confirmed: "badge-confirmed",
    completed: "badge-completed",
    cancelled: "badge-cancelled",
  }[status] || "badge-default";
}

/**
 * Confirm with a natural message, then call updateStatus in the store.
 * Uses alert/confirm for simplicity — replace with your toast/dialog system if present.
 */
async function confirmAndChange(b, nextStatus) {
  let ok = true;
  const human = {
    cancelled: "cancel this booking",
    confirmed: "confirm this booking",
    completed: "mark this booking as completed"
  }[nextStatus] || `set status to ${nextStatus}`;

  // more strict confirm for cancel
  if (nextStatus === "cancelled") {
    ok = confirm(`Are you sure you want to cancel this booking? This cannot always be undone.`);
  } else {
    ok = confirm(`Do you want to ${human}?`);
  }
  if (!ok) return;

  try {
    await bookings.updateStatus(b._id ?? b.id, nextStatus);
    // Optional: show a nicer toast instead of alert
    alert("Booking updated");
    // Optionally refresh full list to reflect server-side state:
    // await bookings.fetchBookings();
  } catch (err) {
    alert(err?.body?.error || err?.message || "Failed to update booking");
  }
}

onMounted(() => {
  bookings.fetchBookings().catch(console.error);
});
</script>

<style scoped>
.list { display:flex; flex-direction:column; gap:12px; margin-top:12px; }
.booking-row { display:flex; justify-content:space-between; gap:12px; padding:14px; align-items:center; }
.left { flex:1; min-width:0; }
.right { display:flex; gap:8px; align-items:center; }

.card { border-radius:10px; background:white; box-shadow: 0 8px 28px rgba(2,6,23,0.05); padding:12px; }

.small { font-size:13px; color:#374151; }
.muted { color:#6b7280; }

/* status badges */
.status-badge {
  display:inline-block;
  padding:6px 10px;
  border-radius:999px;
  font-weight:600;
  text-transform: capitalize;
  font-size:13px;
}
.badge-pending { background:#fef3c7; color:#92400e; }      /* yellow */
.badge-confirmed { background:#e0f2fe; color:#0369a1; }    /* blue */
.badge-completed { background:#dcfce7; color:#166534; }    /* green */
.badge-cancelled { background:#fee2e2; color:#991b1b; }    /* red */
.badge-default { background:#f3f4f6; color:#374151; }

/* buttons */
.btn { background:#2563eb; color:white; border:none; padding:8px 10px; border-radius:8px; cursor:pointer; }
.btn.secondary { background:transparent; border:1px solid #e5e7eb; color:#0f1724; }

/* responsive tweaks */
@media (max-width:720px) {
  .booking-row { flex-direction:column; align-items:flex-start; gap:8px; }
  .right { width:100%; display:flex; gap:8px; }
}
</style>
