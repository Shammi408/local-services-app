<template>
  <div class="auth-card">
    <h2 class="auth-title">Login</h2>

    <form @submit.prevent="doLogin" class="space-y-4" v-if="!showEnablePrompt">
      <input v-model="email" type="email" placeholder="Email" class="auth-input" required />
      <input v-model="password" type="password" placeholder="Password" class="auth-input" required />

      <button type="submit" class="auth-btn" :disabled="auth.loading">
        <span v-if="!auth.loading">Login</span>
        <span v-else>Logging in…</span>
      </button>

      <p v-if="error" class="auth-error">{{ error }}</p>
    </form>

    <!-- After successful login we show the enable-prompt inside the same card -->
    <EnableNotificationsPrompt
      v-if="showEnablePrompt"
      @done="onPromptDone"
      @skipped="onPromptSkipped"
    />

    <p class="auth-footer" v-if="!showEnablePrompt">
      Don’t have an account?
      <router-link to="/signup" class="auth-link">Sign up</router-link>
    </p>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useAuthStore } from "../stores/auth";
import EnableNotificationsPrompt from "../components/EnableNotificationsPrompt.vue";

const email = ref("");
const password = ref("");
const error = ref("");
const auth = useAuthStore();

const showEnablePrompt = ref(false);

async function doLogin() {
  error.value = "";
  try {
    await auth.login(email.value, password.value);

    // Show enable notifications prompt (user must click to allow)
    // We do NOT immediately redirect — wait for user to enable or skip the prompt
    showEnablePrompt.value = true;
  } catch (err) {
    error.value = err?.body?.error || err?.message || "Login failed";
  }
}

function onPromptDone() {
  // user enabled notifications (component has attached subscription)
  // now redirect to appropriate dashboard
  showEnablePrompt.value = false;
  auth.afterLoginRedirect();
}

function onPromptSkipped() {
  // user chose not to enable — proceed to app
  showEnablePrompt.value = false;
  auth.afterLoginRedirect();
}
</script>

<style scoped>
/* Reuse same styles from signup for consistency */
.auth-card { max-width:420px; margin:48px auto; padding:24px; border-radius:10px; background:#fff; box-shadow:0 4px 12px rgba(0,0,0,0.06); }
.auth-title { font-size:1.5rem; font-weight:600; margin-bottom:16px; color:#111827; }
.auth-input { display:block; width:100%; padding:10px; border:1px solid #ddd; border-radius:6px; margin-top:6px; }
.auth-btn { width:100%; padding:10px; border:none; border-radius:6px; background:#2563eb; color:#fff; font-weight:600; cursor:pointer; }
.auth-btn:disabled { opacity:0.6; cursor:not-allowed; }
.auth-error { font-size:13px; color:#b91c1c; margin-top:6px; }
.auth-footer { margin-top:12px; font-size:14px; }
.auth-link { color:#2563eb; text-decoration:underline; }
</style>
