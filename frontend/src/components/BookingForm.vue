<template>
  <div class="modal-backdrop" @click.self="close">
    <div class="modal card">
      <h3>Book: {{ service.title }}</h3>

      <label class="small">Select date & time</label>
      <input type="datetime-local" v-model="when" class="input" />

      <label class="small" style="margin-top:10px">Notes (optional)</label>
      <textarea v-model="notes" rows="4" class="input"></textarea>

      <div style="display:flex; gap:8px; margin-top:12px;">
        <button class="btn" @click="submit" :disabled="loading">
          {{ loading ? "Booking..." : "Confirm booking" }}
        </button>
        <button class="btn secondary" @click="close" :disabled="loading">Cancel</button>
      </div>

      <div v-if="error" class="small" style="color:crimson; margin-top:8px">{{ error }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import { useAuthStore } from "../stores/auth";
import { useBookingsStore } from "../stores/bookings";
import { useRouter } from "vue-router";
const router = useRouter();
const props = defineProps({
  service: { type: Object, required: true },
  show: { type: Boolean, default: false }
});
const emit = defineEmits(["close", "booked"]);

const when = ref("");
const notes = ref("");
const loading = ref(false);
const error = ref("");

const auth = useAuthStore();
const bookings = useBookingsStore();

watch(() => props.show, (v) => {
  if (v) {
    when.value = "";
    notes.value = "";
    error.value = "";
  }
});

function close() {
  emit("close");
}

async function submit() {
  error.value = "";
  if (!when.value) {
    error.value = "Please select date and time";
    return;
  }
  if (!auth.user) {
    // send user to login, then they can come back to this page
    router.push({ path: "/login", query: { redirect: `/services/${props.service._id}/book` } });
    return;
  }
  const selected = new Date(when.value);
  if (Number.isNaN(selected.getTime())) {
    error.value = "Please select a valid date/time.";
    return;
  }
  const now = new Date();
  if (selected <= now) {
    error.value = "Please select a date/time in the future.";
    return;
  }

  loading.value = true;
  try {
    const payload = {
      serviceId: props.service._id,
      date: new Date(when.value).toISOString(),
    };
    const booking = await bookings.createBooking(payload);
    emit("booked", booking);
    close();
  } catch (err) {
    error.value = err?.body?.error || err?.message || "Booking failed";
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.modal-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,0.45); display:flex; justify-content:center; align-items:center; z-index:40; }
.modal { width:420px; max-width:94%; padding:16px; border-radius:12px; }
.input { display:block; width:100%; padding:8px; margin-top:6px; border-radius:8px; border:1px solid #e6eef8; background: #fff; }
.small { font-size:13px; color:#374151; }
.btn { background:#2563eb; color:white; border:none; padding:8px 10px; border-radius:8px; cursor:pointer; }
.btn.secondary { background:transparent; border:1px solid #cbd5e1; color:#0f1724; }
.card { box-shadow: 0 8px 28px rgba(2,6,23,0.08); }
</style>
