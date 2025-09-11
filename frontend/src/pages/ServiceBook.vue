<template>
  <div class="page">
    <div v-if="loading" class="card small">Preparing booking…</div>
    <div v-else-if="error" class="card" style="color:crimson">{{ error }}</div>
    <div v-else-if="!service" class="card">Service not found.</div>
    <div v-else>
      <h1 style="margin-bottom:8px">Book — {{ service.title }}</h1>
      <div class="card" style="margin-bottom:12px;">
        <div class="small muted">Provider:
          <router-link v-if="providerId" :to="`/profile/${providerId}`">{{ providerName }}</router-link>
          <span v-else>Unknown</span>
        </div>
        <p style="margin-top:8px">{{ service.description }}</p>
        <div class="small muted">Price: ₹{{ service.price ?? "-" }}</div>
      </div>

      <!-- BookingForm is a modal component but we use it as inline with show=true -->
      <BookingForm :service="service" :show="true" @booked="onBooked" @close="onClose" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import BookingForm from "../components/BookingForm.vue";
import { useServicesStore } from "../stores/service";
import { useAuthStore } from "../stores/auth";

const route = useRoute();
const router = useRouter();
const store = useServicesStore();
const auth = useAuthStore();

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
  try {
    // ensure auth is loaded so BookingForm's auth checks are meaningful
    if (!auth.user) {
      try { await auth.fetchMe(); } catch (e) { /* ignore */ }
    }

    const s = await store.fetchService(id);
    service.value = s ?? store.current ?? null;

    // If user is not logged in we won't block rendering the page — BookingForm will prompt/log-in
  } catch (err) {
    console.error("ServiceBook load error", err);
    error.value = err?.message || err?.body?.error || "Failed to load service";
  } finally {
    loading.value = false;
  }
}

function onBooked(booking) {
  // Booking succeeded. Navigate to user's bookings page
  router.replace("/bookings");
}

function onClose() {
  // user closed the modal — go back to service detail
  router.back();
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
.page { padding:20px; max-width: var(--container-width, 900px); margin:0 auto; }
.card { padding:12px; border-radius:8px; background:white; box-shadow: 0 6px 18px rgba(2,6,23,0.04); }
.small { font-size:13px; color:#6b7280; }
.muted { color:#6b7280; }
</style>
