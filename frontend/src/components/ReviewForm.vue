<template>
  <div class="review-form card">
    <h4 class="small">{{ isEdit ? "Edit your review" : "Leave a review" }}</h4>

    <div v-if="!canReview" class="muted small">
      You can leave a review after your booking is completed. Go to <router-link to="/bookings">My Bookings</router-link>.
    </div>

    <form v-else @submit.prevent="onSubmit">
      <div class="field">
        <label class="small">Your rating</label>
        <rating-stars v-model="rating" :readOnly="false" helper="Tap a star to set rating" />
      </div>

      <div class="field">
        <label class="small">Comment (optional)</label>
        <textarea v-model="comment" placeholder="Tell others about your experience" maxlength="2000"></textarea>
      </div>

      <div class="field">
        <label class="small">Images (optional, max 2)</label>

        <!-- show existing images (for edit) with remove button -->
        <div v-if="keptImages.length" class="kept-images">
          <div v-for="(img, i) in keptImages" :key="i" class="existing">
            <img :src="img.url" />
            <button type="button" class="remove" @click="removeKept(i)">✕</button>
          </div>
        </div>

        <input type="file" accept="image/*" @change="onFiles" multiple />
        <div class="previews">
          <div v-for="(p,i) in previews" :key="i" class="preview">
            <img :src="p" />
            <button type="button" class="remove" @click="removePreview(i)">✕</button>
          </div>
        </div>
      </div>

      <div class="actions" style="margin-top:10px">
        <button class="btn" :disabled="submitting">
          {{ submitting ? (isEdit ? "Saving…" : "Submitting…") : (isEdit ? "Save changes" : "Submit review") }}
        </button>
        <button type="button" class="btn secondary" @click="reset" :disabled="submitting">Reset</button>
        <button v-if="isEdit" type="button" class="btn secondary" @click="$emit('cancel-edit')" :disabled="submitting">Cancel</button>
      </div>

      <div v-if="error" class="muted" style="color:crimson; margin-top:8px">{{ error }}</div>
    </form>
  </div>
</template>

<script setup>
import { ref, watch, computed } from "vue";
import RatingStars from "./RatingStars.vue";
import api from "../utils/api";
import { useAuthStore } from "../stores/auth";
import { useRouter } from "vue-router";

const props = defineProps({
  serviceId: { type: String, required: true },
  canReview: { type: Boolean, default: false },
  // For edit: pass the existing review object (populated with images array)
  existingReview: { type: Object, default: null },
});

const emit = defineEmits(["submitted", "cancel-edit"]);

const auth = useAuthStore();
const router = useRouter();

const isEdit = computed(() => !!props.existingReview);

const rating = ref(isEdit.value ? (props.existingReview.rating || 0) : 5);
const comment = ref(isEdit.value ? (props.existingReview.comment || "") : "");
const keptImages = ref(isEdit.value ? (props.existingReview.images ? props.existingReview.images.map(i => ({ url: i.url, public_id: i.public_id || null })) : []) : []);
const files = ref([]); // new File objects
const previews = ref([]); // data URLs for client preview

watch(() => props.existingReview, (v) => {
  if (v) {
    rating.value = v.rating || 0;
    comment.value = v.comment || "";
    keptImages.value = v.images ? v.images.map(i => ({ url: i.url, public_id: i.public_id || null })) : [];
    files.value = [];
    previews.value = [];
  }
});

const submitting = ref(false);
const error = ref("");

function onFiles(e) {
  const list = Array.from(e.target.files || []);
  // how many slots left
  const slots = 2 - (keptImages.value.length + files.value.length);
  const allowed = list.slice(0, Math.max(0, slots));
  for (const f of allowed) {
    if (!f.type.startsWith("image/")) continue;
    files.value.push(f);
    const reader = new FileReader();
    reader.onload = (ev) => previews.value.push(ev.target.result);
    reader.readAsDataURL(f);
  }
  e.target.value = "";
}

function removePreview(idx) {
  previews.value.splice(idx, 1);
  files.value.splice(idx, 1);
}

function removeKept(idx) {
  keptImages.value.splice(idx, 1);
}

function reset() {
  rating.value = isEdit.value ? (props.existingReview.rating || 0) : 5;
  comment.value = isEdit.value ? (props.existingReview.comment || "") : "";
  if (isEdit.value) {
    keptImages.value = props.existingReview.images ? props.existingReview.images.map(i => ({ url: i.url, public_id: i.public_id || null })) : [];
  } else {
    keptImages.value = [];
  }
  files.value = [];
  previews.value = [];
  error.value = "";
}

async function onSubmit() {
  error.value = "";
  if (!props.serviceId) return (error.value = "Service missing");
  if (!auth.user && !isEdit.value) {
    router.push({ path: "/login", query: { redirect: `/services/${props.serviceId}` } });
    return;
  }
  if (!props.canReview && !isEdit.value) {
    error.value = "You cannot review this service yet.";
    return;
  }
  if (!rating.value || rating.value < 1) {
    error.value = "Please select a rating.";
    return;
  }

  submitting.value = true;
  try {
    // Build form data
    const fd = new FormData();
    fd.append("rating", String(rating.value));
    if (!isEdit.value) fd.append("serviceId", props.serviceId);
    if (comment.value) fd.append("comment", comment.value);

    // For edit: pass imagesToKeep JSON of keptImages (if any)
    if (isEdit.value) {
      if (keptImages.value.length) {
        fd.append("imagesToKeep", JSON.stringify(keptImages.value));
      } else {
        fd.append("imagesToKeep", JSON.stringify([]));
      }
    }

    // Append new files (respect 2-image max)
    for (let i = 0; i < Math.min(files.value.length, 2); i++) {
      fd.append("images", files.value[i]);
    }

    let result;
    if (isEdit.value) {
      const rid = props.existingReview._id;
      // Use raw request because your api.put expects JSON by default; we need multipart
      const res = await api.raw(`/reviews/${rid}`, { method: "PUT", body: fd });
      result = res.body ?? res;
    } else {
      const res = await api.raw("/reviews", { method: "POST", body: fd });
      result = res.body ?? res;
    }

    emit("submitted", result);
    // reset only for create; for edit parent will close the edit mode
    if (!isEdit.value) reset();
  } catch (err) {
    console.error("submit review err:", err);
    error.value = err?.body?.error || err?.message || "Failed to submit review";
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.review-form { margin-top:14px; padding:12px; }
.field { margin-top:8px; display:flex; flex-direction:column; gap:6px; }
textarea { min-height:80px; resize:vertical; padding:8px; border-radius:6px; border:1px solid #e6eef8; }
.previews { display:flex; gap:8px; margin-top:8px; }
.preview, .existing { position:relative; width:100px; height:72px; border-radius:6px; overflow:hidden; }
.preview img, .existing img { width:100%; height:100%; object-fit:cover; }
.preview .remove, .existing .remove { position:absolute; top:6px; right:6px; background:rgba(0,0,0,0.6); color:white; border:0; border-radius:999px; width:22px; height:22px; cursor:pointer; }
.kept-images { display:flex; gap:8px; margin-top:6px; margin-bottom:6px; }
.actions { display:flex; gap:8px; }
.btn { background:#2563eb; color:white; padding:6px 10px; border-radius:6px; border:0; cursor:pointer; }
.btn.secondary { background:transparent; border:1px solid #e6eef8; color:#0f1724; }
.small { font-size:13px; }
.muted { color:#6b7280; }
</style>
