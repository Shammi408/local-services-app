<template>
  <div class="card">
    <h3>Create account</h3>

    <input v-model="name" class="input" placeholder="Full name" />
    <input v-model="email" class="input" placeholder="Email" type="email" />
    <input v-model="password" class="input" placeholder="Password" type="password" />

    <div style="margin-top:8px;">
      <label style="font-size:14px;">Account type</label>
      <select v-model="role" class="input" style="display:block; width:100%; margin-top:6px;">
        <option value="user">User</option>
        <option value="provider">Provider</option>
      </select>
    </div>

    <div style="margin-top:12px;">
      <button class="btn" :disabled="isSubmitting || !canSubmit" @click="doSignup">
        {{ isSubmitting ? "Creating..." : "Sign up" }}
      </button>
    </div>

    <div v-if="error" class="small" style="color:crimson; margin-top:8px">
      {{ error }}
    </div>

    <div style="margin-top:12px; font-size:14px;">
      Already have an account?
      <router-link to="/login" style="color:blue; text-decoration:underline;">
        Log in
      </router-link>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";

const name = ref("");
const email = ref("");
const password = ref("");
const role = ref("user");
const error = ref("");
const isSubmitting = ref(false);

const auth = useAuthStore();
const router = useRouter();

const canSubmit = computed(() => name.value.trim() && email.value.trim() && password.value.trim());

async function doSignup() {
  if (!canSubmit.value) return;
  error.value = "";
  isSubmitting.value = true;
  try {
    await auth.register({
      name: name.value.trim(),
      email: email.value.trim(),
      password: password.value,
      role: role.value
    });
    // After signup, user is logged in (access token returned by backend).
    router.push("/services");
  } catch (err) {
    // api wrapper returns standardized object { status, body, message }
    error.value = err?.body?.error || err?.message || "Signup failed";
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<style scoped>
/* small helper styles - replace with your app styles */
.card { max-width:420px; margin:28px auto; padding:18px; border-radius:10px; background:#1f2937; color:#fff; }
.input { display:block; width:100%; padding:10px; margin-top:8px; border-radius:6px; border:1px solid #333; background:#0f1724; color:#fff; }
.btn { padding:10px 14px; border-radius:6px; border:none; cursor:pointer; margin-right:8px; background:#2563eb; color:white; }
.small { font-size:13px; }
</style>
