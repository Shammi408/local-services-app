<template>
  <div class="page">
    <div v-if="loading" class="small card">Loading service…</div>

    <div v-else-if="error" class="card" style="color:crimson">
      {{ error }}
    </div>

    <!-- Not the owner -->
    <div v-else-if="!isOwner" class="card">
      You do not have permission to edit this service.
      <div style="margin-top:8px">
        <router-link to="/my-services" class="btn secondary">Back to My Services</router-link>
      </div>
    </div>

    <!-- Provider not verified -->
    <div v-else-if="!isVerified" class="card">
      Your provider account is pending admin verification. You cannot edit services until verified.
    </div>

    <!-- Edit form -->
    <div v-else class="card">
      <h1>Edit Service</h1>

      <label>Title</label>
      <input v-model="form.title" class="input" placeholder="Service title" />

      <label>Description</label>
      <textarea v-model="form.description" class="input" rows="5" placeholder="Describe your service"></textarea>

      <label>Category</label>
      <input v-model="form.category" class="input" placeholder="e.g. Plumbing" />

      <label>Price</label>
      <input type="number" v-model.number="form.price" class="input" placeholder="e.g. 500" />

      <label style="display:flex; align-items:center; gap:8px; margin-top:8px;">
        <input type="checkbox" v-model="form.isAvailable" />
        <span>Available</span>
      </label>
      <!-- Add to the template (near inputs) -->
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

// form object populated from backend
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

// page state
const loading = ref(true);
const saving = ref(false);
const error = ref("");
const formError = ref("");
const success = ref(false);

// file/image state
const MAX_FILES = 5;
const MAX_FILE_SIZE_MB = 5;
const newFiles = ref([]);      // File[]
const previews = ref([]);      // data URLs for new files
const existingImages = ref([]); // URLs from server
const uploadProgress = ref(null);

// computed flags
const isOwner = computed(() => {
  const uid = auth.user?.id ?? auth.user?._id;
  if (!uid || !form.providerId) return false;
  const pid = typeof form.providerId === "object" ? (form.providerId._id ?? form.providerId.id) : form.providerId;
  return pid && pid.toString() === uid.toString();
});
const isVerified = computed(() => !!auth.user?.isVerified);

// helper: load service from backend
async function loadService() {
  loading.value = true;
  error.value = "";
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
    // images may be an array of URLs
    existingImages.value = Array.isArray(body.images) ? [...body.images] : [];
  } catch (err) {
    console.error("Failed to load service:", err);
    if (err?.status === 404) error.value = "Service not found.";
    else error.value = err?.body?.error || err?.message || "Failed to load service";
  } finally {
    loading.value = false;
  }
}

// ensure auth loaded
async function ensureAuth() {
  if (!auth.user) {
    try {
      await auth.fetchMe();
    } catch (e) {
      // ignore — checks below will redirect if necessary
    }
  }
}

// ---------------- file handlers ----------------
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

function removeNewFile(i) {
  if (i < 0 || i >= newFiles.value.length) return;
  newFiles.value.splice(i, 1);
  previews.value.splice(i, 1);
}

function removeExistingImage(idx) {
  if (idx < 0 || idx >= existingImages.value.length) return;
  existingImages.value.splice(idx, 1);
}

// ---------------- validation ----------------
function validate() {
  formError.value = "";
  if (!form.title || !form.title.trim()) {
    formError.value = "Title is required.";
    return false;
  }
  if (form.price == null || Number(form.price) <= 0) {
    formError.value = "Price must be greater than 0.";
    return false;
  }
  return true;
}

// helper to get API base for XHR
function getApiBase() {
  return import.meta.env.VITE_API_BASE || "http://localhost:3000/api";
}

// ---------------- save (PUT) ----------------
async function save() {
  // ensure auth loaded so isOwner/isVerified compute correctly
  if (!auth.user) {
    try { await auth.fetchMe(); } catch (e) { /* ignore */ }
  }

  formError.value = "";
  error.value = "";
  success.value = false;

  if (!validate()) return;
  if (!isOwner.value) {
    formError.value = "You are not allowed to edit this service.";
    return;
  }
  if (!isVerified.value) {
    formError.value = "Your provider account must be verified before editing services.";
    return;
  }

  saving.value = true;
  uploadProgress.value = null;

  try {
    // If there are new files, send multipart PUT including existingImages[] to keep
    if (newFiles.value.length > 0) {
      const formData = new FormData();
      formData.append("title", form.title.trim());
      formData.append("description", form.description?.trim() ?? "");
      formData.append("category", form.category?.trim() ?? "");
      formData.append("price", String(Number(form.price)));
      formData.append("isAvailable", String(!!form.isAvailable));
      // include which existing images to keep
      existingImages.value.forEach((url) => formData.append("existingImages[]", url));
      // append new files
      newFiles.value.forEach((f) => formData.append("images", f));

      // Use XHR to track progress
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        const url = `${getApiBase()}/services/${id}`;
        xhr.open("PUT", url, true);

        // set auth header if token in localStorage
        try {
          const token = localStorage.getItem("token");
          if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        } catch (e) {}

        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            uploadProgress.value = Math.round((evt.loaded / evt.total) * 100);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const parsed = xhr.responseText ? JSON.parse(xhr.responseText) : {};
              // update form from returned data if present
              if (parsed) {
                form.title = parsed.title ?? form.title;
                form.description = parsed.description ?? form.description;
                form.category = parsed.category ?? form.category;
                form.price = parsed.price ?? form.price;
                form.isAvailable = parsed.isAvailable ?? form.isAvailable;
              }
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
      // no new files — send JSON with remaining images
      const payload = {
        title: form.title.trim(),
        description: form.description?.trim(),
        category: form.category?.trim(),
        price: Number(form.price),
        isAvailable: !!form.isAvailable,
        images: existingImages.value
      };
      const res = await api.put(`/services/${id}`, payload);
      const body = res.body ?? res;
      // update local form from response
      form.title = body.title ?? form.title;
      form.description = body.description ?? form.description;
      form.category = body.category ?? form.category;
      form.price = body.price ?? form.price;
      form.isAvailable = body.isAvailable ?? form.isAvailable;
      existingImages.value = Array.isArray(body.images) ? [...body.images] : existingImages.value;
    }

    success.value = true;
    // clear new files/previews (we keep existingImages as returned by server)
    newFiles.value = [];
    previews.value = [];
    uploadProgress.value = null;

    // short delay then redirect
    setTimeout(() => router.replace("/provider/services"), 800);
  } catch (err) {
    console.error("Save error:", err);
    if (err?.status === 401) {
      router.push({ path: "/login", query: { redirect: route.fullPath } });
      return;
    }
    if (err?.status === 403) {
      formError.value = err?.body?.error || "Not allowed to update this service";
    } else {
      formError.value = err?.body?.error || err?.message || "Failed to save changes";
    }
  } finally {
    saving.value = false;
    uploadProgress.value = null;
  }
}

// initial mount: ensure auth + load service
onMounted(async () => {
  await ensureAuth();
  await loadService();
});
</script>

<style scoped>
.page {
  max-width: 760px;
  margin: 0 auto;
  padding: 20px;
}

.card {
  background: #fff;
  padding: 18px;
  border-radius: 10px;
  box-shadow: 0 6px 18px rgba(2, 6, 23, 0.04);
}

.input {
  display: block;
  width: 100%;
  padding: 8px;
  margin-top: 6px;
  margin-bottom: 12px;
  border-radius: 8px;
  border: 1px solid #e6eef8;
}

.btn {
  background: #2563eb;
  color: white;
  padding: 8px 12px;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.btn.secondary {
  background: transparent;
  border: 1px solid #e6eef8;
  color: #0f1724;
  padding: 6px 10px;
  border-radius: 8px;
}

.small {
  font-size: 13px;
  color: #6b7280;
}

/* ---- Image previews ---- */
.existing-previews,
.previews {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin: 8px 0 12px;
}

.preview {
  position: relative;
  width: 120px;
  height: 90px;
  border-radius: 8px;
  overflow: hidden;
  background: #f3f4f6;
  box-shadow: 0 2px 6px rgba(0,0,0,0.08);
}

.preview img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.preview .tiny {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(0,0,0,0.6);
  color: #fff;
  border: none;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  font-size: 12px;
  cursor: pointer;
  line-height: 20px;
  text-align: center;
  padding: 0;
}
.preview .tiny:hover {
  background: rgba(220,38,38,0.85); /* red-600 */
}
</style>

