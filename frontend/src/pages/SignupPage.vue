<template>
  <div class="auth-card">
    <h2 class="auth-title">Create Account</h2>

    <form @submit.prevent="doSignup" class="space-y-4">
      <input v-model="name" type="text" placeholder="Full name" class="auth-input" required />
      <input v-model="email" type="email" placeholder="Email" class="auth-input" required />
      <input v-model="password" type="password" placeholder="Password" class="auth-input" required />

      <div>
        <label class="block text-sm mb-1">Account type</label>
        <select v-model="role" class="auth-input">
          <option value="user">User</option>
          <option value="provider">Provider</option>
        </select>
      </div>

      <button type="submit" class="auth-btn" :disabled="isSubmitting || !canSubmit">
        {{ isSubmitting ? "Creating..." : "Sign up" }}
      </button>

      <p v-if="error" class="auth-error">{{ error }}</p>
    </form>

    <p class="auth-footer">
      Already have an account?
      <router-link to="/login" class="auth-link">Log in</router-link>
    </p>
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
    await auth.register({ name: name.value.trim(), email: email.value.trim(), password: password.value, role: role.value });
    router.push("/services");
  } catch (err) {
    error.value = err?.body?.error || err?.message || "Signup failed";
  } finally {
    isSubmitting.value = false;
  }
}
</script>

<style scoped>
.auth-card { max-width:420px; margin:48px auto; padding:24px; border-radius:10px; background:#fff; box-shadow:0 4px 12px rgba(0,0,0,0.06); }
.auth-title { font-size:1.5rem; font-weight:600; margin-bottom:16px; color:#111827; }
.auth-input { display:block; width:100%; padding:10px; border:1px solid #ddd; border-radius:6px; margin-top:6px; }
.auth-btn { width:100%; padding:10px; border:none; border-radius:6px; background:#2563eb; color:#fff; font-weight:600; cursor:pointer; }
.auth-btn:disabled { opacity:0.6; cursor:not-allowed; }
.auth-error { font-size:13px; color:#b91c1c; margin-top:6px; }
.auth-footer { margin-top:12px; font-size:14px; }
.auth-link { color:#2563eb; text-decoration:underline; }
</style>
