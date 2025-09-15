<template>
  <div class="page">
    <div v-if="loading" class="card small">Loading service…</div>
    <div v-else-if="error" class="card" style="color:crimson">{{ error }}</div>
    <div v-else-if="!service" class="card">Service not found.</div>

    <div v-else class="card">
      <!-- Image gallery -->
      <div class="gallery" v-if="service.images && service.images.length">
        <img v-for="(img, i) in service.images" :key="i" :src="(typeof img === 'string' ? img : img.url)" alt="service image" />
      </div>
      <div v-else class="gallery">
        <img src="/placeholder-service.png" alt="no image" />
      </div>

      <div class="header">
        <div>
          <h1>{{ service.title }}</h1>
          <div class="small muted">by
            <router-link v-if="providerId" :to="`/profile/${providerId}`">{{ providerName }}</router-link>
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

      <!-- RATINGS SUMMARY -->
      <div style="margin-top:12px; display:flex; gap:12px; align-items:center;">
        <rating-stars :avg="service.ratingAverage" :count="service.ratingCount" :readOnly="true" />
      </div>

      <!-- REVIEWS: list + form -->
      <reviews-list
        :service-id="service._id"
        @delete-review="onDeleteReview"
        @edit-review="onEditReview"
        @refresh="onReviewsChanged"
        ref="reviewsList"
      ></reviews-list>

      <review-form
        v-if="canReview && !service.hasReviewed"
        :service-id="service._id"
        :can-review="canReview"
        @submitted="onReviewSubmitted"
      />

    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRoute } from "vue-router";
import { useServicesStore } from "../stores/service";
import api from "../utils/api";

import ReviewsList from "../components/ReviewsList.vue";
import ReviewForm from "../components/ReviewForm.vue";
import RatingStars from "../components/RatingStars.vue";
import { useAuthStore } from "../stores/auth";

const route = useRoute();
const store = useServicesStore();
const auth = useAuthStore();

const id = route.params.id;
const loading = ref(true);
const error = ref("");
const service = ref(null);
const providerId = computed(() => service.value?.providerId?._id ?? service.value?.providerId);
const providerName = computed(() => service.value?.providerId?.name ?? "Provider");

const canReview = ref(false); // only set true if user has completed booking
const reviewsList = ref(null);

function isAuthor(r) {
  const uid = auth.user?.id ?? auth.user?._id;
  return uid && r.userId && (r.userId._id ?? r.userId).toString() === uid.toString();
}

async function load() {
  loading.value = true;
  error.value = "";
  try {
    service.value = await store.fetchService(id);

    // check whether the current user can submit a review:
    // we try to detect if user has at least one completed booking for this service.
    // Adjust endpoint if your backend differs.
    canReview.value = false;
    if (auth.user) {
      try {
        // This expects your bookings route to support query filtering by serviceId & status.
        const q = `?serviceId=${encodeURIComponent(id)}&status=completed&limit=1`;
        const res = await api.get(`/bookings${q}`);
        // api.get returns {status, body} in your utils; adapt to its shape
        const body = res.body ?? res;
        // body.items or body array
        const matches = Array.isArray(body) ? body : (body.items ?? (body.bookings ?? []));
        if (matches && matches.length > 0) canReview.value = true;
      } catch (err) {
        // fail safe: assume not allowed; don't block UI
        console.warn("Could not verify booking completion for review:", err);
      }
    }
  } catch (err) {
    console.error("Failed to load service:", err);
    error.value = err?.message || "Failed to load service";
  } finally {
    loading.value = false;
  }
}

// when a new review is submitted, refresh reviews and service rating
async function onReviewSubmitted(newReview) {
  try {
    // reload reviews list
    if (reviewsList.value && typeof reviewsList.value.load === "function") {
      reviewsList.value.load(1);
    } else {
      // as fallback, emit refresh event to child
      // (ReviewsList emits 'refresh' we could listen to; here we just re-mount via key etc)
    }
    // refresh service data (to show updated ratingAverage)
    service.value = await store.fetchService(id);
  } catch (err) {
    console.error("Error after review submit:", err);
  }
}
// called when child requests a refresh (edit/delete/save)
async function onReviewsChanged() {
  try {
    // refresh service to get updated ratingAverage & ratingCount
    service.value = await store.fetchService(id);

    // also reload reviews list (if needed)
    if (reviewsList.value && typeof reviewsList.value.load === "function") {
      await reviewsList.value.load(1);
    }
  } catch (err) {
    console.error("Failed to refresh after reviews changed:", err);
  }
}

async function onDeleteReview(reviewId) {
  // Optional: send delete request and reload
  try {
    await api.del(`/reviews/${reviewId}`);
    // reload reviews & service
    if (reviewsList.value && typeof reviewsList.value.load === "function") reviewsList.value.load(1);
    service.value = await store.fetchService(id);
  } catch (err) {
    console.error("Failed to delete review:", err);
    alert("Could not delete review");
  }
}

function onEditReview(review) {
  // Optional: you can open a modal for editing the review or route to a review edit page
  // For now we just log
  console.log("edit review requested:", review);
}

onMounted(() => { if (id) load(); });
</script>


<style scoped>
.page { padding: 20px; }
.card { background: white; padding: 16px; border-radius: 8px; box-shadow: 0 3px 12px rgba(0,0,0,0.06); }
.small { font-size:13px; color:#6b7280; }
.muted { color:#6b7280; }
.btn { background:#2563eb; color:#fff; padding:6px 10px; border-radius:6px; text-decoration:none; display:inline-block; }
.gallery { display:flex; gap:8px; flex-wrap:wrap; margin-bottom:16px; }
.gallery img { width:200px; height:140px; object-fit:cover; border-radius:8px; }
.header { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
</style>
