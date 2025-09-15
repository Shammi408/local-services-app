<script setup>
import { ref, computed, watch } from "vue";

const props = defineProps({
  avg: { type: [Number, String], default: 0 }, // average or rating number
  count: { type: Number, default: undefined }, // total number of ratings
  readOnly: { type: Boolean, default: true },
  modelValue: { type: Number, default: 0 }, // v-model for interactive stars
  helper: { type: String, default: "" },
  title: { type: String, default: "" },
});

const emit = defineEmits(["update:modelValue"]);

const rating = ref(Number(props.modelValue || 0));
const hover = ref(0);

// sync from parent
watch(() => props.modelValue, (v) => { rating.value = Number(v || 0); });

// interactions
function set(n) {
  rating.value = Number(n);
  emit("update:modelValue", rating.value);
}
function onHover(n) { hover.value = Number(n); }
function onLeave() { hover.value = 0; }

const activeValue = computed(() => hover.value > 0 ? hover.value : rating.value);

// ⭐ for readOnly display
const filledCount = computed(() => {
  const num = Number(props.avg ?? 0);
  if (!Number.isFinite(num) || num <= 0) return 0;
  return props.readOnly ? Math.round(num) : num;
});

// show avg text
const displayAvg = computed(() => {
  const n = Number(props.avg ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "0";
  return (Math.round((n + Number.EPSILON) * 100) / 100).toFixed(1).replace(/\.0$/, "");
});
</script>

<template>
  <div class="rating-stars" :title="title">
    <!-- READONLY -->
    <template v-if="readOnly">
      <span v-if="count === 0" class="muted">No ratings yet</span>
      <template v-else>
        <span class="avg">{{ displayAvg }}</span>
        <span class="stars" aria-hidden="true">
          <span
            v-for="n in 5"
            :key="`ro-star-${n}`"
            class="star"
            :class="{ filled: n <= filledCount }"
          >★</span>
        </span>
        <small v-if="count !== undefined" class="muted">({{ count }})</small>
      </template>
    </template>

    <!-- INTERACTIVE -->
    <template v-else>
      <span class="stars-input" role="radiogroup">
        <button
          v-for="n in 5"
          :key="`btn-star-${n}`"
          type="button"
          class="star-btn"
          :aria-pressed="n === rating"
          @click="set(n)"
          @mouseover="onHover(n)" @mouseleave="onLeave"
          @pointerenter="onHover(n)" @pointerleave="onLeave"
        >
          <span class="star" :class="{ filled: n <= activeValue }">★</span>
        </button>
      </span>
      <span v-if="helper" class="small-muted">{{ helper }}</span>
    </template>
  </div>
</template>

<style scoped>
.rating-stars { display:flex; align-items:center; gap:8px; font-size:14px; }
.stars .star { color:#e5e7eb; margin-right:2px; }
.star.filled { color:#f59e0b; }
.stars-input .star-btn {
  background:transparent;
  border:0;
  cursor:pointer;
  font-size:18px;
  padding:2px;
}
.avg { font-weight:700; margin-right:6px; }
.muted { color:#6b7280; font-size:12px; }
.small-muted { font-size:12px; color:#6b7280; margin-left:6px; }
</style>
