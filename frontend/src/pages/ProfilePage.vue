<template>
  <div class="page">
    <h1>My Profile</h1>

    <div v-if="loading" class="small">Loading...</div>

    <div v-else>
      <div class="card">
        <div class="flex">
          <img :src="form.profilePic || placeholder" class="avatar" />
          <div style="margin-left:12px">
            <h2>{{ form.name || "Unnamed" }}</h2>
            <p class="muted">{{ form.email }}</p>
            <p class="role">Role: {{ form.role }}</p>
          </div>
        </div>

        <div v-if="editing" style="margin-top:16px;">
          <label>Name</label>
          <input v-model="form.name" class="input" />

          <label>Phone</label>
          <input v-model="form.phone" class="input" />

          <label>Address</label>
          <input v-model="form.address" class="input" />

          <label>Profile picture URL</label>
          <input v-model="form.profilePic" class="input" />

          <label>Experience</label>
          <textarea v-model="form.experience" class="input"></textarea>

          <div style="margin-top:12px; display:flex; gap:8px;">
            <button class="btn" @click="save" :disabled="saving">Save</button>
            <button class="btn secondary" @click="cancelEdit">Cancel</button>
          </div>

          <div v-if="error" style="color:crimson; margin-top:8px;">{{ error }}</div>
        </div>

        <div v-else style="margin-top:16px;">
          <p><strong>Phone:</strong> {{ form.phone || "—" }}</p>
          <p><strong>Address:</strong> {{ form.address || "—" }}</p>
          <p><strong>Experience:</strong> {{ form.experience || "—" }}</p>

          <div style="margin-top:12px; display:flex; gap:8px;">
            <button class="btn" @click="editing = true">Edit Profile</button>
            <router-link v-if="isProvider" to="/services/new" class="btn">+ Create Service</router-link>
          </div>
        </div>
      </div>

      <!-- debug area (only visible in dev) -->
      <div style="margin-top:12px; font-size:12px; color:#6b7280">
        <div><strong>Debug:</strong></div>
        <div>Resolved user id: <code>{{ resolvedId || "—" }}</code></div>
        <div v-if="lastRequestUrl">Last request: <code>{{ lastRequestUrl }}</code></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed, watch } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import api from "../utils/api";

const router = useRouter();
const auth = useAuthStore();

const placeholder = "/placeholder-avatar.png";

const loading = ref(true);
const editing = ref(false);
const saving = ref(false);
const error = ref("");

const form = reactive({
  _id: "",
  name: "",
  email: "",
  phone: "",
  address: "",
  profilePic: "",
  role: "",
  experience: ""
});

// debug helpers
const resolvedId = ref("");
const lastRequestUrl = ref("");

// compute provider role quickly
const isProvider = computed(() => auth.user?.role === "provider");
watch(() => auth.user, () => { if (auth.user) populateFromObject(auth.user); });

// helper: extract user id from many possible shapes
function extractUserId(u) {
  if (!u) return null;
  // common shapes: { _id: '...', id: '...' }
  if (u._id) return u._id;
  if (u.id) return u.id;
  // some auth stores wrap user: { user: { _id: ... } }
  if (u.user && (u.user._id || u.user.id)) return u.user._id ?? u.user.id;
  // maybe token object etc
  return null;
}

function populateFromObject(u) {
  form._id = u._id ?? u.id ?? "";
  form.name = u.name ?? "";
  form.email = u.email ?? "";
  form.phone = u.phone ?? "";
  form.address = u.address ?? "";
  form.profilePic = u.profilePic ?? "";
  form.role = u.role ?? "";
  form.experience = u.experience ?? "";
}

// load current user's profile by resolving id from auth.user
async function load() {
  loading.value = true;
  error.value = "";
  try {
    // ensure auth.user is loaded
    if (!auth.user) {
      try {
        await auth.fetchMe();
      } catch (e) {
        // not logged in -> redirect to login
        router.push({ path: "/login", query: { redirect: "/profile" } });
        return;
      }
    }

    // resolve id robustly
    const uid = extractUserId(auth.user);
    resolvedId.value = uid;
    if (!uid) {
      // final fallback: some stores keep user in auth.user.user
      resolvedId.value = auth.user?.user?._id ?? auth.user?.user?.id ?? "";
    }

    if (!resolvedId.value) {
      error.value = "Could not determine current user id. Check auth.user shape in console.";
      console.error("auth.user:", auth.user);
      loading.value = false;
      return;
    }

    // debug url for network tab
    lastRequestUrl.value = `/api/profile/${resolvedId.value}`;

    // call backend
    const res = await api.get(`/profile/${resolvedId.value}`);
    // backend may return the user object directly
    const body = res.body ?? res;
    populateFromObject(body);

  } catch (err) {
    console.error("Profile load error:", err);
    error.value = err?.body?.error || err?.message || "Failed to load profile";
  } finally {
    loading.value = false;
  }
}

async function save() {
  saving.value = true;
  error.value = "";
  try {
    const payload = {
      name: form.name,
      phone: form.phone,
      address: form.address,
      profilePic: form.profilePic,
      experience: form.experience
    };
    // ensure we have id
    const uid = resolvedId.value || extractUserId(auth.user);
    if (!uid) throw new Error("User id missing");
    lastRequestUrl.value = `/api/profile/${uid} (PUT)`;
    const res = await api.put(`/profile/${uid}`, payload);
    // update local data from returned body (or refetch)
    const body = res.body ?? res;
    populateFromObject(body);
    // refresh auth store if available
    try {
      await auth.fetchMe();
    } catch (e) {
      console.warn("Failed to refresh auth after profile update", e);
    }
    editing.value = false;
  } catch (err) {
    console.error("Save profile error:", err);
    error.value = err?.body?.error || err?.message || "Failed to save profile";
  } finally {
    saving.value = false;
  }
}

function cancelEdit() {
  editing.value = false;
  // reload to reset
  load().catch(() => {});
}

onMounted(() => {
  load();
});
</script>

<style scoped>
.page { max-width: 760px; margin: 0 auto; padding: 20px; }
.card { background:#fff; padding:20px; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.06); }
.flex { display:flex; align-items:center; }
.avatar { width:80px; height:80px; border-radius:50%; object-fit:cover; }
.input { display:block; width:100%; padding:8px; margin-top:4px; margin-bottom:12px; border:1px solid #ddd; border-radius:6px; }
.btn { padding:8px 12px; border:none; border-radius:6px; background:#2563eb; color:white; cursor:pointer; }
.btn.secondary { background:#f3f4f6; color:#111827; }
.muted { color:#6b7280; font-size:14px; }
.role { font-size:13px; color:#374151; margin-top:4px; }
</style>
