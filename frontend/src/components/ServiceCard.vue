<template>
  <div class="card svc-card">
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

    <p class="small desc" v-if="service.description">{{ shortDesc }}</p>

    <div class="footer" style="display:flex; justify-content:space-between; align-items:center; margin-top:8px;">
      <router-link :to="`/services/${service._id}`" class="btn small">View</router-link>
      <div class="small rating">⭐ {{ displayRating }} <span class="muted">({{ service.ratingCount ?? 0 }})</span></div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
const props = defineProps({
  service: { type: Object, required: true }
});

// providerId can be either the populated object or a plain id string
const providerRaw = props.service.providerId ?? {};
const providerId = computed(() => {
  if (!providerRaw) return null;
  if (typeof providerRaw === "string") return providerRaw;
  return providerRaw._id ?? providerRaw.id ?? null;
});
const providerName = computed(() => {
  if (!providerRaw) return "Provider";
  if (typeof providerRaw === "string") return "Provider";
  return providerRaw.name || providerRaw.title || "Provider";
});
const profileLink = computed(() => `/profile/${providerId.value ?? ""}`);

const shortDesc = computed(() => {
  const d = props.service.description ?? "";
  return d.length > 120 ? d.slice(0, 117) + "…" : d;
});

const displayRating = computed(() => {
  const avg = Number(props.service.ratingAverage) || 0;
  return Math.round(avg * 10) / 10;
});
</script>

<style scoped>
.card {
  background: white;
  padding: 12px;
  border-radius: 10px;
  box-shadow: 0 6px 18px rgba(2,6,23,0.04);
}
.svc-card { display:flex; flex-direction:column; gap:8px; }
.space-between { display:flex; justify-content:space-between; align-items:flex-start; }
.left { min-width:0; }
.title { font-size:16px; }
.byline { margin-top:6px; color:#6b7280; font-size:13px; }
.provider-link { color: #2563eb; text-decoration: none; }
.desc { color:#374151; margin-top:6px; }
.price { font-weight:600; }
.footer .rating { color:#374151; }
.muted { color:#6b7280; margin-left:6px; }
.btn { background:#2563eb; color:white; padding:6px 8px; border-radius:8px; text-decoration:none; display:inline-flex; align-items:center; }
.small { font-size:13px; color:#111827; }
</style>
