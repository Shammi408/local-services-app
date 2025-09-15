<template>
  <div class="page">
    <h1>My Profile</h1>

    <div v-if="loading" class="small">Loading...</div>

    <div v-else>
      <div class="card">
        <!-- Header -->
        <div class="flex">
          <img :src="tempAvatarPreview || form.profilePic || placeholder" class="avatar" />
          <div style="margin-left:12px">
            <h2>{{ form.name || "Unnamed" }}</h2>
            <p class="muted">{{ form.email }}</p>
            <p class="role">Role: {{ form.role }}</p>
          </div>
        </div>

        <!-- Editing mode -->
        <div v-if="editing" style="margin-top:16px;">
          <label>Name</label>
          <input v-model="form.name" class="input" />

          <label>Phone</label>
          <input v-model="form.phone" class="input" />

          <label>Address</label>
          <input v-model="form.address" class="input" />

          <label>Profile picture</label>
          <input type="file" accept="image/*" @change="onAvatarSelected" />
          <img
            v-if="tempAvatarPreview"
            :src="tempAvatarPreview"
            class="avatar-preview"
          />

          <!-- Experience only for providers -->
          <label v-if="isProvider">Experience</label>
          <textarea v-if="isProvider" v-model="form.experience" class="input"></textarea>

          <div style="margin-top:12px; display:flex; gap:8px; align-items:center;">
            <button class="btn" @click="save" :disabled="saving">
              <span v-if="saving">Saving…</span>
              <span v-else>Save</span>
            </button>
            <button class="btn secondary" @click="cancelEdit" :disabled="saving">Cancel</button>
          </div>

          <div v-if="error" style="color:crimson; margin-top:8px;">{{ error }}</div>
        </div>

        <!-- View mode -->
        <div v-else style="margin-top:16px;">
          <p><strong>Phone:</strong> {{ form.phone || "—" }}</p>
          <p><strong>Address:</strong> {{ form.address || "—" }}</p>
          <p v-if="isProvider"><strong>Experience:</strong> {{ form.experience || "—" }}</p>

          <div style="margin-top:12px; display:flex; gap:8px;">
            <button class="btn" @click="startEditing">Edit Profile</button>
            <router-link v-if="isProvider" to="/services/new" class="btn">+ Create Service</router-link>
          </div>
        </div>
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

// Profile form
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

// Temp avatar state
const tempAvatarFile = ref(null);
const tempAvatarPreview = ref("");

// Helpers
const resolvedId = ref("");
const isProvider = computed(() => auth.user?.role === "provider");

watch(() => auth.user, () => { if (auth.user) populateFromObject(auth.user); });

function extractUserId(u) {
  if (!u) return null;
  return u._id || u.id || u.user?._id || u.user?.id || null;
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

function onAvatarSelected(e) {
  const file = e.target.files[0];
  if (!file) return;

  const MAX_MB = 5;
  if (file.size > MAX_MB * 1024 * 1024) {
    error.value = `File exceeds ${MAX_MB} MB limit.`;
    return;
  }

  tempAvatarFile.value = file;
  const reader = new FileReader();
  reader.onload = (ev) => { tempAvatarPreview.value = ev.target.result; };
  reader.readAsDataURL(file);
}

// Load profile
async function load() {
  loading.value = true;
  error.value = "";
  try {
    if (!auth.user) {
      try {
        await auth.fetchMe();
      } catch {
        router.push({ path: "/login", query: { redirect: "/profile" } });
        return;
      }
    }
    const uid = extractUserId(auth.user);
    resolvedId.value = uid;
    if (!uid) throw new Error("Cannot resolve user ID");

    const res = await api.get(`/profile/${uid}`);
    const body = res.body ?? res;
    populateFromObject(body);
  } catch (err) {
    console.error("Profile load error:", err);
    error.value = err?.body?.error || err?.message || "Failed to load profile";
  } finally {
    loading.value = false;
  }
}

// Save profile
async function save() {
  saving.value = true;
  error.value = "";
  try {
    let finalAvatarUrl = form.profilePic || "";

    if (tempAvatarFile.value) {
      const fd = new FormData();
      fd.append("avatar", tempAvatarFile.value);
      const upRes = await api.post("/uploads/avatar", fd, true);
      const upBody = upRes.body ?? upRes;
      finalAvatarUrl = upBody.url || finalAvatarUrl;
    }

    const payload = {
      name: form.name,
      phone: form.phone,
      address: form.address,
      profilePic: finalAvatarUrl,
      experience: form.experience
    };

    const uid = resolvedId.value || extractUserId(auth.user);
    if (!uid) throw new Error("User id missing");

    const res = await api.put(`/profile/${uid}`, payload);
    const body = res.body ?? res;
    populateFromObject(body);

    await auth.fetchMe().catch(() => {});
    editing.value = false;

    tempAvatarFile.value = null;
    tempAvatarPreview.value = "";
  } catch (err) {
    console.error("Save profile error:", err);
    error.value = err?.body?.error || err?.message || "Failed to save profile";
  } finally {
    saving.value = false;
  }
}

function startEditing() {
  editing.value = true;
  tempAvatarFile.value = null;
  tempAvatarPreview.value = "";
}

function cancelEdit() {
  editing.value = false;
  tempAvatarFile.value = null;
  tempAvatarPreview.value = "";
  load().catch(() => {});
}

onMounted(load);
</script>

<style scoped>
.page { max-width: 760px; margin: 0 auto; padding: 20px; }
.card { background:#fff; padding:20px; border-radius:10px; box-shadow:0 2px 8px rgba(0,0,0,0.06); }
.flex { display:flex; align-items:center; }
.avatar { width:80px; height:80px; border-radius:50%; object-fit:cover; }
.input { display:block; width:100%; padding:8px; margin-top:4px; margin-bottom:12px; border:1px solid #ddd; border-radius:6px; }
.btn { padding:8px 12px; border:none; border-radius:6px; background:#2563eb; color:white; cursor:pointer; font-weight:600; }
.btn.secondary { background:#f3f4f6; color:#111827; }
.muted { color:#6b7280; font-size:14px; }
.role { font-size:13px; color:#374151; margin-top:4px; }
.avatar-preview {
  width: 80px;
  height: 80px;
  border-radius: 50%;
  object-fit: cover;
  margin-top: 8px;
}
</style>
