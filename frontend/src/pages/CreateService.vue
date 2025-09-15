<template>
  <div class="page">
    <h1>Create New Service</h1>

    <div v-if="initialLoading" class="card small">Checking account…</div>
    <div v-else-if="!isProvider" class="card">You are not a provider. Only providers can create services.</div>
    <div v-else-if="!isVerified" class="card">Your provider account is pending admin verification. You will be able to create services once verified.</div>

    <div v-else class="card">
      <label for="title">Title <span class="req">*</span></label>
      <input id="title" ref="titleRef" v-model="title" class="input" placeholder="e.g. Home plumbing — hourly" :disabled="saving" />
      <div v-if="fieldError.title" class="field-error">{{ fieldError.title }}</div>

      <label for="description">Description</label>
      <textarea id="description" v-model="description" class="input" rows="5" placeholder="Describe your service" :disabled="saving"></textarea>

      <label for="category">Category</label>
      <input id="category" v-model="category" class="input" placeholder="e.g. Plumbing, Tutoring" :disabled="saving" />

      <label for="tags">Tags</label>
      <div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
        <input id="tags" v-model="tagInput" @keyup.enter.prevent="addTag" class="input small" placeholder="e.g. tutoring" :disabled="saving" />
        <button class="btn secondary" @click="addTag" :disabled="!tagInput || saving">Add</button>
      </div>

      <!-- suggestions -->
      <div class="tag-suggestions" v-if="tagSuggestions.length">
        <button v-for="t in tagSuggestions" :key="t" class="suggestion" @click="addSuggested(t)" :disabled="saving || tags.length >= MAX_TAGS">
          {{ t }}
        </button>
      </div>

      <div class="tags-row" v-if="tags.length">
        <button v-for="(t, idx) in tags" :key="t" class="tag-chip">
          {{ t }}
          <span style="margin-left:8px; cursor:pointer;" @click.prevent="removeTag(idx)">✕</span>
        </button>
      </div>

      <label for="price">Price <span class="req">*</span></label>
      <input id="price" type="number" v-model.number="price" class="input" placeholder="e.g. 500" :min="0" :disabled="saving" />
      <div v-if="fieldError.price" class="field-error">{{ fieldError.price }}</div>

      <label for="images" style="margin-top:8px">Images (optional)</label>
      <input id="images" type="file" accept="image/*" multiple @change="onFilesSelected" :disabled="saving || files.length >= MAX_FILES" />
      <div class="small muted">You may upload up to {{ MAX_FILES }} images. Max {{ MAX_FILE_SIZE_MB }} MB each.</div>

      <div class="previews" v-if="previews.length">
        <div v-for="(p, i) in previews" :key="i" class="preview">
          <img :src="p" alt="preview" />
          <button class="tiny" @click="removeFile(i)" :disabled="saving">✕</button>
        </div>
      </div>

      <div style="margin-top:12px; display:flex; gap:8px; align-items:center">
        <button class="btn" @click="create" :disabled="saving">
          <span v-if="saving">Creating…</span>
          <span v-else>Create Service</span>
        </button>

        <router-link to="/my-services" class="btn secondary" :aria-disabled="saving">Cancel</router-link>
      </div>

      <div v-if="uploadProgress !== null" style="margin-top:8px" class="small">Uploading... {{ uploadProgress }}%</div>
      <div v-if="error" style="color:crimson; margin-top:8px;">{{ error }}</div>
      <div v-if="success" style="color:green; margin-top:8px;">Service created — redirecting…</div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useAuthStore } from "../stores/auth";
import api from "../utils/api";
import { useRouter } from "vue-router";

const auth = useAuthStore();
const router = useRouter();

const title = ref("");
const description = ref("");
const category = ref("");
const price = ref(null);

const tagInput = ref("");
const tags = ref([]);
const tagSuggestions = ref([]);

const MAX_TAGS = 5;
const MAX_FILES = 5;
const MAX_FILE_SIZE_MB = 5;

const saving = ref(false);
const error = ref("");
const success = ref(false);
const initialLoading = ref(true);

const fieldError = ref({ title: "", price: "" });
const titleRef = ref(null);

// Image upload state
const files = ref([]); // File[]
const previews = ref([]);
const uploadProgress = ref(null);

// helpers
function normalizeTag(t) {
  return (t || "").trim().toLowerCase();
}
function addTag() {
  const t = normalizeTag(tagInput.value);
  if (!t) return;
  if (tags.value.includes(t)) {
    tagInput.value = "";
    return;
  }
  if (tags.value.length >= MAX_TAGS) {
    error.value = `You may add up to ${MAX_TAGS} tags.`;
    tagInput.value = "";
    return;
  }
  tags.value.push(t);
  tagInput.value = "";
  error.value = "";
}
function addSuggested(t) {
  const nt = normalizeTag(t);
  if (!tags.value.includes(nt) && tags.value.length < MAX_TAGS) tags.value.push(nt);
}
function removeTag(i) {
  tags.value.splice(i, 1);
}

// auth
async function ensureAuth() {
  if (!auth.user) {
    try { await auth.fetchMe(); } catch (e) {}
  }
}

const isProvider = computed(() => !!(auth.user && auth.user.role === "provider"));
const isVerified = computed(() => !!(auth.user && auth.user.isVerified));

onMounted(async () => {
  initialLoading.value = true;
  await ensureAuth();

  // fetch tag suggestions from server
  try {
    const res = await api.get("/services/tags");
    tagSuggestions.value = (res.body ?? res) || [];
  } catch (e) {
    tagSuggestions.value = [];
  }

  initialLoading.value = false;
  if (titleRef.value) titleRef.value.focus();
});

// file input handlers
function onFilesSelected(e) {
  const chosen = Array.from(e.target.files || []);
  for (const f of chosen) {
    if (files.value.length >= MAX_FILES) break;
    if (f.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
      error.value = `File ${f.name} exceeds ${MAX_FILE_SIZE_MB} MB limit.`;
      continue;
    }
    files.value.push(f);
    createPreview(f);
  }
  e.target.value = "";
}
function createPreview(file) {
  const reader = new FileReader();
  reader.onload = (ev) => previews.value.push(ev.target.result);
  reader.readAsDataURL(file);
}
function removeFile(idx) {
  files.value.splice(idx, 1);
  previews.value.splice(idx, 1);
}

// validation
function validateFields() {
  fieldError.value = { title: "", price: "" };
  let ok = true;
  if (!title.value || !title.value.trim()) {
    fieldError.value.title = "Title is required.";
    ok = false;
  }
  if (price.value == null || Number(price.value) <= 0) {
    fieldError.value.price = "Price must be greater than 0.";
    ok = false;
  }
  return ok;
}

// create flow: upload images first (to /api/uploads/image), then POST /api/services
async function create() {
  error.value = "";
  success.value = false;

  if (!validateFields()) return;
  if (!isProvider.value) { error.value = "Only providers can create services."; return; }
  if (!isVerified.value) { error.value = "Your provider account is not yet verified."; return; }

  saving.value = true;
  uploadProgress.value = 0;

  // Prepare upload target and token
  const API_BASE = (api._API_BASE || import.meta.env.VITE_API_BASE || "http://localhost:3000").replace(/\/+$/, "");
  const uploadUrl = API_BASE.endsWith("/api") ? `${API_BASE}/uploads/image` : `${API_BASE}/api/uploads/image`;
  const token = localStorage.getItem("token");

  // collect uploaded images here
  const uploadedImages = [];

  try {
    // 1) upload files (if any)
    for (let i = 0; i < files.value.length; i++) {
      const f = files.value[i];
      const fd = new FormData();
      fd.append("file", f);

      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const resp = await fetch(uploadUrl, {
        method: "POST",
        headers, // DO NOT set Content-Type when sending FormData
        body: fd,
      });

      if (!resp.ok) {
        const txt = await resp.text().catch(() => null);
        throw { status: resp.status, body: txt, message: "Image upload failed" };
      }

      const body = await resp.json();
      uploadedImages.push({ url: body.url, public_id: body.public_id || null });

      // update progress roughly: files completed / total
      uploadProgress.value = Math.round(((i + 1) / Math.max(1, files.value.length)) * 100);
    }

    // 2) create service (JSON)
    const payload = {
      title: title.value.trim(),
      description: description.value?.trim() ?? "",
      category: category.value?.trim() ?? "",
      price: Number(price.value || 0),
      tags: tags.value || [],
      images: uploadedImages,
    };

    await api.post("/services", payload);

    success.value = true;
    // Clear form
    title.value = ""; description.value = ""; category.value = "";
    price.value = null; files.value = []; previews.value = []; tags.value = [];

    setTimeout(() => router.replace("/provider/services"), 800);
  } catch (err) {
    if (err?.status === 401) { router.push({ path: "/login", query: { redirect: "/services/new" } }); return; }
    console.error("create service failed", err);
    error.value = err?.body?.error || err?.message || "Failed to create service";
  } finally {
    saving.value = false;
    uploadProgress.value = null;
  }
}
</script>

<style scoped>
/* Page/card */
.page { max-width: 900px; margin: 24px auto; padding: 0 16px; }
.card {
  background: #fff;
  padding: 20px;
  border-radius: 10px;
  box-shadow: 0 8px 30px rgba(2,6,23,0.04);
  color: var(--text, #0b1220);
}

/* Headline */
h1 { margin: 0 0 16px 0; font-size: 28px; }

/* Form layout */
label { display: block; margin-top: 12px; font-weight:600; color: #111827; }
.input { display:block; width:100%; padding:10px 12px; margin-top:6px; border-radius:8px; border:1px solid #e6eef8; box-sizing:border-box; font-size:14px; }
.input.small { width: 220px; padding:8px 10px; }

/* Small helper text */
.small { font-size:13px; color:#6b7280; margin-top:6px; }

/* Buttons */
.btn { padding:8px 12px; border-radius:8px; background:#2563eb; color:white; border:none; cursor:pointer; font-weight:600; }
.btn.secondary { background:transparent; border:1px solid #e6eef8; color:#0f1724; padding:8px 10px; }

/* Top controls row (search/category/price grouping) */
.form-row { display:flex; gap:12px; align-items:flex-start; flex-wrap:wrap; }
.form-row > * { flex: 1 1 220px; min-width: 160px; }

/* Tag UI */
.tag-chip { display:inline-flex; align-items:center; gap:8px; padding:6px 10px; border-radius:999px; background:#eef2ff; color:#0b3b94; margin-right:8px; margin-bottom:6px; border:none; }
.tag-suggestions { margin-bottom:8px; display:flex; gap:8px; flex-wrap:wrap; }
.suggestion { border:1px solid rgba(0,0,0,0.06); background:white; padding:6px 8px; border-radius:6px; cursor:pointer; }

/* Image previews */
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

/* Field error */
.field-error { color:#b91c1c; font-size:13px; margin-top:6px; }

/* Responsive tweaks */
@media (max-width: 720px) {
  .form-row { flex-direction: column; }
  .input.small { width:100%; }
}
</style>
