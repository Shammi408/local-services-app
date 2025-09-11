<template>
  <div class="page">
    <h1>Create New Service</h1>

    <!-- auth loading -->
    <div v-if="initialLoading" class="card small">Checking account…</div>

    <!-- Not a provider -->
    <div v-else-if="!isProvider" class="card">
      You are not a provider. Only providers can create services.
    </div>

    <!-- Provider not verified -->
    <div v-else-if="!isVerified" class="card">
      Your provider account is pending admin verification. You will be able to create services once verified.
    </div>

    <!-- Form for verified provider -->
    <div v-else class="card">
      <label for="title">Title <span class="req">*</span></label>
      <input id="title" ref="titleRef" v-model="title" class="input" placeholder="e.g. Home plumbing — hourly" :disabled="saving" />
      <div v-if="fieldError.title" class="field-error">{{ fieldError.title }}</div>

      <label for="description">Description</label>
      <textarea id="description" v-model="description" class="input" rows="5" placeholder="Describe your service" :disabled="saving"></textarea>

      <label for="category">Category</label>
      <input id="category" v-model="category" class="input" placeholder="e.g. Plumbing, Tutoring" :disabled="saving" />

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

const saving = ref(false);
const error = ref("");
const success = ref(false);
const initialLoading = ref(true);

const fieldError = ref({ title: "", price: "" });
const titleRef = ref(null);

// Image upload state
const MAX_FILES = 5;
const MAX_FILE_SIZE_MB = 5;
const files = ref([]); // File[]
const previews = ref([]);
const uploadProgress = ref(null); // percent number or null

// ensure auth.user is loaded (safe)
async function ensureAuth() {
  if (!auth.user) {
    try {
      await auth.fetchMe();
    } catch (e) {
      // not logged in
    }
  }
}

// computed flags
const isProvider = computed(() => !!(auth.user && auth.user.role === "provider"));
const isVerified = computed(() => !!(auth.user && auth.user.isVerified));

onMounted(async () => {
  initialLoading.value = true;
  await ensureAuth();
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
  // clear native input so same file can be reselected if removed
  e.target.value = "";
}

function createPreview(file) {
  const reader = new FileReader();
  reader.onload = (ev) => {
    previews.value.push(ev.target.result);
  };
  reader.readAsDataURL(file);
}

function removeFile(idx) {
  files.value.splice(idx, 1);
  previews.value.splice(idx, 1);
}

// small validator function (client-side)
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

// POST create (uses FormData when files exist)
async function create() {
  error.value = "";
  success.value = false;

  // client-side validation
  if (!validateFields()) return;

  if (!isProvider.value) {
    error.value = "Only providers can create services.";
    return;
  }
  if (!isVerified.value) {
    error.value = "Your provider account is not yet verified.";
    return;
  }

  saving.value = true;
  uploadProgress.value = null;

  try {
    // If files selected, use FormData
    if (files.value.length > 0) {
      const form = new FormData();
      form.append("title", title.value.trim());
      form.append("description", description.value?.trim() ?? "");
      form.append("category", category.value?.trim() ?? "");
      form.append("price", String(Number(price.value)));
      // append files (images[])
      files.value.forEach((f, i) => form.append("images", f)); // backend should accept images[]
      // Use raw fetch to track progress (api.raw won't give progress easily). We'll build a fetch call here.
      // Build full URL
      const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3000/api";
      const url = `${API_BASE}/services`;

      // Use XMLHttpRequest to get upload progress (fetch doesn't support progress natively)
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", url, true);
        // add Authorization header if token exists
        const token = localStorage.getItem("token");
        if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            uploadProgress.value = Math.round((event.loaded / event.total) * 100);
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(xhr.responseText ? JSON.parse(xhr.responseText) : {});
          } else {
            let body = {};
            try { body = xhr.responseText ? JSON.parse(xhr.responseText) : {}; } catch {}
            const err = { status: xhr.status, body, message: body?.error || xhr.statusText };
            reject(err);
          }
        };

        xhr.onerror = () => {
          reject({ status: 0, message: "Network error" });
        };

        xhr.withCredentials = false; // change to true if backend expects cookies; we send token header
        xhr.send(form);
      });

    } else {
      // no files: fallback to JSON POST via api.post
      const res = await api.post("/services", {
        title: title.value.trim(),
        description: description.value?.trim(),
        category: category.value?.trim(),
        price: Number(price.value)
      });
      // fine — continue to set created id below if backend returned
    }

    success.value = true;
    // Clear form
    title.value = "";
    description.value = "";
    category.value = "";
    price.value = null;
    files.value = [];
    previews.value = [];

    // redirect to provider services
    setTimeout(() => router.replace("/provider/services"), 800);
  } catch (err) {
    if (err?.status === 401) {
      router.push({ path: "/login", query: { redirect: "/services/new" } });
      return;
    }
    error.value = err?.body?.error || err?.message || "Failed to create service";
  } finally {
    saving.value = false;
    uploadProgress.value = null;
  }
}
</script>

<style scoped>
/* add small styles for previews */
.previews { display:flex; gap:8px; margin-top:8px; flex-wrap:wrap; }
.preview { position:relative; width:96px; height:72px; border-radius:8px; overflow:hidden; box-shadow:0 6px 18px rgba(2,6,23,0.06); }
.preview img { width:100%; height:100%; object-fit:cover; display:block; }
.preview .tiny { position:absolute; top:6px; right:6px; background:rgba(0,0,0,0.6); color:white; border:none; border-radius:6px; width:22px; height:22px; cursor:pointer; }
.field-error { color:#b91c1c; font-size:13px; margin-bottom:8px; }
.req { color:#b91c1c; margin-left:4px; }

.page { max-width: 600px; margin: 0 auto; padding: 20px; }
.card { background:#fff; padding:20px; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.06); }
.input { display:block; width:100%; padding:8px; margin-top:4px; margin-bottom:12px; border:1px solid #ddd; border-radius:6px; }
.btn { padding:8px 12px; border:none; border-radius:6px; background:#2563eb; color:white; cursor:pointer; }
</style>
