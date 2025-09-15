<template>
  <div class="card svc-card">
    <div class="thumb-wrap">
      <img
        :src="serviceImage"
        alt="service"
        class="svc-thumb"
      />
    </div>

    <div class="top space-between">
      <div class="left">
        <h4 class="title" style="margin:0">{{ service.title }}</h4>
        <div class="small byline">
          by
          <router-link :to="profileLink" class="provider-link">{{ providerName }}</router-link>
        </div>
      </div>

      <div class="price">
        <div class="small">₹{{ service.price ?? "—" }}</div>
      </div>
    </div>

    <div class="tags">
      <span v-for="t in service.tags || []" :key="t" class="tag">#{{ t }}</span>
    </div>

    <p class="small desc" v-if="service.description">{{ shortDesc }}</p>

    <div class="footer">
      <router-link :to="`/services/${service._id}`" class="btn small">View</router-link>
      <div class="small rating">
        ⭐ {{ displayRating }} <span class="muted">({{ service.ratingCount ?? 0 }})</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const props = defineProps({
  service: { type: Object, required: true }
});

const providerId = computed(() => props.service.providerId?._id ?? props.service.providerId);
const providerName = computed(() => props.service.providerId?.name ?? "Provider");
const profileLink = computed(() => `/profile/${providerId.value ?? ""}`);

const shortDesc = computed(() => {
  const d = props.service.description ?? "";
  return d.length > 120 ? d.slice(0, 117) + "…" : d;
});

const displayRating = computed(() => {
  const avg = Number(props.service.ratingAverage) || 0;
  return Math.round(avg * 10) / 10;
});
const serviceImage = computed(() => {
  const imgs = props.service.images || [];
  if (!imgs || imgs.length === 0) return "/placeholder-service.png";
  const first = imgs[0];
  if (typeof first === "string") return first;
  if (first && typeof first === "object") return first.url || "/placeholder-service.png";
  return "/placeholder-service.png";
});
</script>

<style scoped>
.card {
  background: white;
  padding: 12px;
  border-radius: 10px;
  box-shadow: 0 6px 18px rgba(2,6,23,0.04);
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 240px; /* keeps cards roughly aligned */
}

/* Thumbnail frame: use aspect-ratio if supported */
.thumb-wrap {
  width: 100%;
  border-radius: 8px;
  overflow: hidden;
  background: #f8fafc;
  display: block;
}
.svc-thumb {
  display: block;
  width: 100%;
  height: auto;
  object-fit: cover;
  /* preferred: maintain 4:3 frame */
  aspect-ratio: 4 / 3;
  min-height: 120px; /* fallback for older browsers */
}

/* layout sections */
.space-between { display:flex; justify-content:space-between; align-items:flex-start; gap:8px; }
.title { font-size:16px; margin:0; line-height:1.25; }
.byline { margin-top:6px; color:#6b7280; font-size:13px; }
.provider-link { color:#2563eb; text-decoration: none; }
.desc { color:#374151; margin-top:6px; font-size:14px; line-height:1.45; flex: 1 1 auto; }
.price { font-weight:700; font-size:14px; }
.footer { display:flex; justify-content:space-between; align-items:center; margin-top:8px; gap:8px; }

/* rating + small text */
.footer .rating { color:#374151; font-size:13px; display:flex; align-items:center; gap:6px; }
.muted { color:#6b7280; margin-left:6px; }

/* buttons & tags */
.btn { background:#2563eb; color:white; padding:6px 10px; border-radius:8px; text-decoration:none; display:inline-flex; align-items:center; font-size:13px; }
.btn.small { padding:6px 10px; font-size:13px; }
.tags { margin-top:8px; display:flex; gap:6px; flex-wrap:wrap; }
.tag { background:#eef2ff; color:#3730a3; padding:4px 8px; border-radius:999px; font-size:12px; }

/* responsive adjustments: slightly bigger thumbs on wider screens */
@media (min-width: 720px) {
  .card { min-height: 260px; }
  .svc-thumb { aspect-ratio: 16/9; }
}
@media (min-width: 1100px) {
  .card { min-height: 280px; }
}
</style>
