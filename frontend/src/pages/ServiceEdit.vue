<template>
  <div class="page">
    <div v-if="loading" class="small card">Loading service…</div>
    <div v-else-if="error" class="card" style="color:crimson">{{ error }}</div>
    <div v-else-if="!isOwner" class="card">
      You do not have permission to edit this service.
      <div style="margin-top:8px"><router-link to="/my-services" class="btn secondary">Back to My Services</router-link></div>
    </div>

    <div v-else-if="!isVerified" class="card">Your provider account is pending admin verification. You cannot edit services until verified.</div>

    <div v-else class="card">
      <h1>Edit Service</h1>

      <label>Title</label>
      <input v-model="form.title" class="input" placeholder="Service title" />

      <label>Description</label>
      <textarea v-model="form.description" class="input" rows="5" placeholder="Describe your service"></textarea>

      <label>Category</label>
      <input v-model="form.category" class="input" placeholder="e.g. Plumbing" />

      <label>Tags</label>
      <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
        <input v-model="tagInput" @keyup.enter.prevent="addTag" class="input small" placeholder="Add tag" />
        <button class="btn secondary" @click="addTag" :disabled="!tagInput">Add</button>
      </div>
      <div class="tag-suggestions" v-if="tagSuggestions.length">
        <button v-for="t in tagSuggestions" :key="t" class="suggestion" @click="addSuggested(t)">{{ t }}</button>
      </div>
      <div class="tags-row" v-if="tags.length">
        <button v-for="(t, idx) in tags" :key="t" class="tag-chip">{{ t }} <span style="margin-left:8px; cursor:pointer;" @click.prevent="removeTag(idx)">✕</span></button>
      </div>

      <label>Price</label>
      <input type="number" v-model.number="form.price" class="input" placeholder="e.g. 500" />

      <label style="display:flex; align-items:center; gap:8px; margin-top:8px;">
        <input type="checkbox" v-model="form.isAvailable" />
        <span>Available</span>
      </label>

      <label>Images</label>
      <div class="existing-previews" v-if="existingImages.length">
        <div v-for="(url, idx) in existingImages" :key="url" class="preview">
          <img :src="url" alt="existing" />
          <button class="tiny" @click="removeExistingImage(idx)" :disabled="saving">✕</button>
        </div>
      </div>

      <label>Upload new images</label>
      <input type="file" accept="image/*" multiple @change="onFilesSelected" :disabled="saving || newFiles.length >= MAX_FILES" />
      <div class="previews" v-if="previews.length">
        <div v-for="(p, i) in previews" :key="i" class="preview">
          <img :src="p" alt="preview" />
          <button class="tiny" @click="removeNewFile(i)" :disabled="saving">✕</button>
        </div>
      </div>

      <div style="display:flex; gap:8px; margin-top:12px;">
        <button class="btn" @click="save" :disabled="saving">{{ saving ? "Saving..." : "Save changes" }}</button>
        <router-link to="/my-services" class="btn secondary">Cancel</router-link>
      </div>

      <div v-if="formError" style="color:crimson; margin-top:8px;">{{ formError }}</div>
      <div v-if="success" style="color:green; margin-top:8px;">Saved — redirecting…</div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import api from "../utils/api";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const id = route.params.id;

const form = reactive({
  _id: "",
  title: "",
  description: "",
  category: "",
  price: null,
  isAvailable: true,
  providerId: null,
  images: []
});

const loading = ref(true);
const saving = ref(false);
const error = ref("");
const formError = ref("");
const success = ref(false);

// tags state
const tags = ref([]);
const tagInput = ref("");
const tagSuggestions = ref([]);

// file/image state
const MAX_FILES = 5;
const MAX_FILE_SIZE_MB = 5;
const newFiles = ref([]);
const previews = ref([]);
const existingImages = ref([]);

// computed flags
const isOwner = computed(() => {
  const uid = auth.user?.id ?? auth.user?._id;
  if (!uid || !form.providerId) return false;
  const pid = typeof form.providerId === "object" ? (form.providerId._id ?? form.providerId.id) : form.providerId;
  return pid && pid.toString() === uid.toString();
});
const isVerified = computed(() => !!auth.user?.isVerified);

// helper functions for tags
function normalizeTag(t) { return (t || "").trim().toLowerCase(); }
function addTag() {
  const t = normalizeTag(tagInput.value);
  if (!t) return;
  if (!tags.value.includes(t) && tags.value.length < 5) tags.value.push(t);
  tagInput.value = "";
}
function addSuggested(t) {
  const nt = normalizeTag(t);
  if (!tags.value.includes(nt) && tags.value.length < 5) tags.value.push(nt);
}
function removeTag(i) { tags.value.splice(i, 1); }

// load service & tag suggestions
async function loadService() {
  loading.value = true;
  try {
    const res = await api.get(`/services/${id}`);
    const body = res.body ?? res;
    form._id = body._id ?? body.id;
    form.title = body.title ?? "";
    form.description = body.description ?? "";
    form.category = body.category ?? "";
    form.price = body.price ?? null;
    form.isAvailable = body.isAvailable !== undefined ? body.isAvailable : true;
    form.providerId = body.providerId ?? body.providerId;
    existingImages.value = Array.isArray(body.images) ? body.images.map(it => (typeof it === 'string' ? it : it.url || '')) : [];
    tags.value = Array.isArray(body.tags) ? body.tags.map(t => (String(t).toLowerCase())) : [];
  } catch (err) {
    console.error("Failed to load service:", err);
    error.value = err?.body?.error || err?.message || "Failed to load service";
  } finally {
    loading.value = false;
  }
}

async function loadTagSuggestions() {
  try {
    const res = await api.get("/services/tags");
    tagSuggestions.value = (res.body ?? res) || [];
  } catch (e) {
    tagSuggestions.value = [];
  }
}

// file handlers (same as before)
function onFilesSelected(e) {
  formError.value = "";
  const chosen = Array.from(e.target.files || []);
  for (const f of chosen) {
    if (newFiles.value.length + existingImages.value.length >= MAX_FILES) {
      formError.value = `You can upload up to ${MAX_FILES} images (including existing).`;
      break;
    }
    if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      formError.value = `File "${f.name}" exceeds ${MAX_FILE_SIZE_MB} MB limit.`;
      continue;
    }
    newFiles.value.push(f);
    createPreviewForNew(f);
  }
  e.target.value = "";
}
function createPreviewForNew(file) {
  const reader = new FileReader();
  reader.onload = (ev) => previews.value.push(ev.target.result);
  reader.readAsDataURL(file);
}
function removeNewFile(i) { newFiles.value.splice(i, 1); previews.value.splice(i, 1); }
function removeExistingImage(idx) { existingImages.value.splice(idx, 1); }

// save: include tags (either in formData or JSON)
function getApiBase() {
  const base = import.meta.env.VITE_API_BASE || "http://localhost:3000";
  return base.endsWith("/api") ? base : base + "/api";
}
async function save() {
  if (!auth.user) { try { await auth.fetchMe(); } catch (e) {} }

  formError.value = "";
  error.value = "";
  success.value = false;

  if (!form.title || !form.title.trim()) { formError.value = "Title is required."; return; }
  if (form.price == null || Number(form.price) <= 0) { formError.value = "Price must be greater than 0."; return; }
  if (!isOwner.value) { formError.value = "You are not allowed to edit this service."; return; }
  if (!isVerified.value) { formError.value = "Your provider account must be verified before editing services."; return; }

  saving.value = true;

  try {
    if (newFiles.value.length > 0) {
      // multipart PUT with existingImages[] and tags JSON
      const formData = new FormData();
      formData.append("title", form.title.trim());
      formData.append("description", form.description?.trim() ?? "");
      formData.append("category", form.category?.trim() ?? "");
      formData.append("price", String(Number(form.price)));
      formData.append("isAvailable", String(!!form.isAvailable));

      // append kept existing images (strings)
      existingImages.value.forEach(url => formData.append("existingImages[]", url));

      // append tags as JSON string
      formData.append("tags", JSON.stringify(tags.value));

      // append new files
      newFiles.value.forEach(f => formData.append("images", f));

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const url = `${getApiBase()}/services/${id}`;
        xhr.open("PUT", url, true);
        try {
          const token = localStorage.getItem("token");
          if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        } catch (e) {}
        xhr.upload.onprogress = (evt) => {
          // optional: show progress somewhere
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const parsed = xhr.responseText ? JSON.parse(xhr.responseText) : {};
              // update local form values
              form.title = parsed.title ?? form.title;
              form.description = parsed.description ?? form.description;
              form.category = parsed.category ?? form.category;
              form.price = parsed.price ?? form.price;
              form.isAvailable = parsed.isAvailable ?? form.isAvailable;
              existingImages.value = Array.isArray(parsed.images) ? parsed.images.map(it => (typeof it === 'string' ? it : it.url || '')) : existingImages.value;
              tags.value = Array.isArray(parsed.tags) ? parsed.tags.map(t => String(t).toLowerCase()) : tags.value;
            } catch {}
            resolve();
          } else {
            let body = {};
            try { body = xhr.responseText ? JSON.parse(xhr.responseText) : {}; } catch {}
            reject({ status: xhr.status, body, message: body?.error || xhr.statusText });
          }
        };
        xhr.onerror = () => reject({ status: 0, message: "Network error" });
        xhr.withCredentials = false;
        xhr.send(formData);
      });
    } else {
      // JSON PUT
      const payload = {
        title: form.title.trim(),
        description: form.description?.trim(),
        category: form.category?.trim(),
        price: Number(form.price),
        isAvailable: !!form.isAvailable,
        images: existingImages.value,
        tags: tags.value
      };
      const res = await api.put(`/services/${id}`, payload);
      const body = res.body ?? res;
      form.title = body.title ?? form.title;
      form.description = body.description ?? form.description;
      form.category = body.category ?? form.category;
      form.price = body.price ?? form.price;
      form.isAvailable = body.isAvailable ?? form.isAvailable;
      existingImages.value = Array.isArray(body.images) ? body.images : existingImages.value;
      tags.value = Array.isArray(body.tags) ? body.tags.map(t => String(t).toLowerCase()) : tags.value;
    }

    success.value = true;
    newFiles.value = [];
    previews.value = [];
    setTimeout(() => router.replace("/provider/services"), 800);
  } catch (err) {
    console.error("Save error:", err);
    if (err?.status === 401) { router.push({ path: "/login", query: { redirect: route.fullPath } }); return; }
    if (err?.status === 403) formError.value = err?.body?.error || "Not allowed to update this service";
    else formError.value = err?.body?.error || err?.message || "Failed to save changes";
  } finally {
    saving.value = false;
  }
}

onMounted(async () => {
  await loadService();
  await loadTagSuggestions();
});
</script>

<style scoped>
/* Keep the styling consistent with CreateService */
.page { max-width: 900px; margin: 24px auto; padding: 0 16px; }
.card {
  background: #fff;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 8px 30px rgba(2,6,23,0.04);
  color: var(--text, #0b1220);
}
h1 { margin: 0 0 16px 0; font-size: 24px; }

label { display:block; margin-top:12px; font-weight:600; color:#111827; }
.input { display:block; width:100%; padding:10px 12px; margin-top:6px; border-radius:8px; border:1px solid #e6eef8; box-sizing:border-box; font-size:14px; }
.input.small { width:220px; }

.form-row { display:flex; gap:12px; align-items:flex-start; flex-wrap:wrap; }
.form-row > * { flex: 1 1 220px; min-width:160px; }

.tag-chip { display:inline-flex; align-items:center; gap:8px; padding:6px 10px; border-radius:999px; background:#eef2ff; color:#0b3b94; margin-right:8px; margin-bottom:6px; border:none; }
.tag-suggestions { margin-bottom:8px; display:flex; gap:8px; flex-wrap:wrap; }
.suggestion { border:1px solid rgba(0,0,0,0.06); background:white; padding:6px 8px; border-radius:6px; cursor:pointer; }

/* Keep previews the same size as CreateService */
.previews,
.existing-previews { display:flex; gap:8px; margin-top:8px; flex-wrap:wrap; align-items:flex-start; }
.preview {
  position:relative;
  width:120px;
  height:90px;
  border-radius:8px;
  overflow:hidden;
  box-shadow: 0 6px 18px rgba(2,6,23,0.04);
  background:#f8fafc;
  display:flex;
  align-items:center;
  justify-content:center;
}
.preview img { width:100%; height:100%; object-fit:cover; display:block; }
.preview .tiny { position:absolute; top:6px; right:6px; background:rgba(0,0,0,0.6); color:white; border:none; border-radius:6px; width:22px; height:22px; cursor:pointer; }

.btn { padding:8px 12px; border-radius:8px; background:#2563eb; color:white; border:none; cursor:pointer; font-weight:600; }
.btn.secondary { background:transparent; border:1px solid #e6eef8; color:#0f1724; padding:8px 10px; }

@media (max-width:720px) {
  .form-row { flex-direction:column; }
  .input.small { width:100%; }
}
</style>
