<template>
  <div class="reviews-list">
    <h3 class="small">Reviews ({{ meta.total ?? reviews.length }})</h3>

    <div v-if="loading" class="small muted">Loading reviews…</div>
    <div v-else>
      <div v-if="reviews.length === 0" class="muted small">No reviews yet. Be the first to review!</div>

      <div v-for="r in reviews" :key="r._id" class="review card">
        <div v-if="editingId !== r._id">
          <div class="row">
            <div class="user">
              <div class="name">{{ r.userId?.name || 'User' }}</div>
              <div class="muted small">{{ formatDate(r.createdAt) }}</div>
            </div>

            <div class="rating-right">
              <rating-stars :avg="Number(r.rating)" :readOnly="true" />

            </div>
          </div>

          <div class="comment" v-if="r.comment">{{ r.comment }}</div>

          <div class="images" v-if="r.images && r.images.length">
            <a v-for="(img, i) in r.images" :key="i" :href="img.url" target="_blank" rel="noopener">
              <img :src="img.url" class="thumb" />
            </a>
          </div>

          <div class="review-actions" v-if="isAuthor(r)">
            <button class="btn small secondary" @click="confirmDelete(r._id)">Delete</button>
            <button class="btn small" @click="startEdit(r)">Edit</button>
          </div>
        </div>

        <div v-else>
          <!-- Inline edit form for review r -->
          <review-form
            :service-id="serviceId"
            :existing-review="r"
            :can-review="true"
            @submitted="onEditSaved"
            @cancel-edit="cancelEdit"
          ></review-form>
        </div>
      </div>

      <div class="pager" v-if="meta.totalPages > 1">
        <button class="btn small" :disabled="page <= 1" @click="setPage(page - 1)">Prev</button>
        <div class="small muted">Page {{ page }} / {{ meta.totalPages }}</div>
        <button class="btn small" :disabled="page >= meta.totalPages" @click="setPage(page + 1)">Next</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import RatingStars from "./RatingStars.vue";
import ReviewForm from "./ReviewForm.vue";
import { useAuthStore } from "../stores/auth";
import api from "../utils/api";

const props = defineProps({
  serviceId: { type: String, required: true },
  initialReviews: { type: Array, default: () => [] },
  initialMeta: { type: Object, default: () => ({}) },
});

const emit = defineEmits(["refresh", "delete-review"]);

const auth = useAuthStore();

const reviews = ref(props.initialReviews || []);
const meta = ref({
  page: props.initialMeta.page || 1,
  limit: props.initialMeta.limit || 12,
  total: props.initialMeta.total || reviews.value.length,
  totalPages: props.initialMeta.totalPages || 1
});
const loading = ref(false);
const page = ref(meta.value.page || 1);

const editingId = ref(null);

async function load(p = 1) {
  loading.value = true;
  try {
    const qs = `?page=${p}&limit=${meta.value.limit}`;
    const res = await api.get(`/reviews/service/${props.serviceId}${qs}`);
    const body = res.body ?? res;
    reviews.value = body.reviews ?? [];
    meta.value.page = body.page ?? 1;
    meta.value.limit = body.limit ?? meta.value.limit;
    meta.value.total = body.total ?? reviews.value.length;
    meta.value.totalPages = body.totalPages ?? 1;
    page.value = meta.value.page;
  } catch (err) {
    console.error("load reviews error:", err);
  } finally {
    loading.value = false;
  }
}

function setPage(n) {
  if (n < 1 || n > meta.value.totalPages) return;
  load(n);
}

function formatDate(d) {
  try { return new Date(d).toLocaleString(); } catch { return d; }
}

function isAuthor(r) {
  const uid = auth.user?.id ?? auth.user?._id;
  return uid && r.userId && (r.userId._id ?? r.userId).toString() === uid.toString();
}

function startEdit(r) {
  editingId.value = r._id;
}

function cancelEdit() {
  editingId.value = null;
}

async function onEditSaved(updated) {
  // updated is the server response for the edited review
  editingId.value = null;
  await load(page.value);
  emit("refresh");
}

async function confirmDelete(id) {
  if (!confirm("Delete this review? This cannot be undone.")) return;
  try {
    await api.del(`/reviews/${id}`);
    // reload current page
    await load(page.value);
    // notify parent to refresh service aggregate too
    emit("refresh");
  } catch (err) {
    console.error("Failed to delete review:", err);
    alert("Could not delete review");
  }
}

// expose load() to parent
defineExpose({ load });

// watch service changes
watch(() => props.serviceId, () => load(1), { immediate: true });
</script>

<style scoped>
.reviews-list { margin-top:12px; }
.review { padding:12px; margin:10px 0; border-radius:8px; background:#fff; box-shadow:0 4px 12px rgba(0,0,0,0.03); }
.row { display:flex; justify-content:space-between; align-items:flex-start; gap:12px; }
.user .name { font-weight:700; }
.images { display:flex; gap:8px; margin-top:8px; }
.images img.thumb { width:80px; height:60px; object-fit:cover; border-radius:6px; }
.review-actions { margin-top:8px; display:flex; gap:8px; }
.small { font-size:13px; }
.muted { color:#6b7280; }
.pager { display:flex; gap:12px; align-items:center; justify-content:center; margin-top:10px; }
</style>
