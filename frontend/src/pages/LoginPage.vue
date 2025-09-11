<template>
  <div class="max-w-md mx-auto mt-20 p-6 bg-white rounded shadow">
    <h2 class="text-2xl font-semibold mb-4">Login</h2>

    <form @submit.prevent="doLogin" class="space-y-4">
      <div>
        <label class="block text-sm font-medium mb-1">Email</label>
        <input v-model="email" type="email" required class="w-full px-3 py-2 border rounded" />
      </div>

      <div>
        <label class="block text-sm font-medium mb-1">Password</label>
        <input v-model="password" type="password" required class="w-full px-3 py-2 border rounded" />
      </div>

      <div class="flex items-center justify-between">
        <button
          type="submit"
          class="px-4 py-2 bg-blue-600 text-white rounded hover:opacity-90 disabled:opacity-50"
          :disabled="auth.loading"
        >
          <span v-if="!auth.loading">Login</span>
          <span v-else class="flex items-center gap-2">
            <svg class="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" stroke-opacity="0.2"></circle>
              <path d="M22 12a10 10 0 00-10-10" stroke="currentColor" stroke-width="4" stroke-linecap="round"></path>
            </svg>
            Logging in...
          </span>
        </button>

        <router-link to="/register" class="text-sm text-gray-600 hover:underline">Create account</router-link>
      </div>

      <p v-if="error" class="text-sm text-red-600">{{ error }}</p>
    </form>

    <!-- Toast: simple inline notification -->
    <transition name="fade">
      <div
        v-if="showToast"
        class="fixed right-4 bottom-6 bg-green-600 text-white px-4 py-2 rounded shadow-lg"
        role="status"
        aria-live="polite"
      >
        {{ toastMessage }}
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { useAuthStore } from "../stores/auth";
import { useRouter } from "vue-router";

const email = ref("");
const password = ref("");
const error = ref("");
const auth = useAuthStore();
const router = useRouter();

// toast state
const showToast = ref(false);
const toastMessage = ref("");

async function doLogin() {
  error.value = "";
  try {
    // call your auth.login (it sets token & user or fetches me)
    await auth.login(email.value, password.value);

    // show success toast
    toastMessage.value = "Login successful — redirecting...";
    showToast.value = true;

    // hide toast after a short time
    // NOTE: we delay redirect slightly so user can see the toast.
    // If you want instant redirect, remove the setTimeout and call auth.afterLoginRedirect() directly.
    setTimeout(() => {
      showToast.value = false;
    }, 1200);

    // redirect according to role
    // auth.afterLoginRedirect() will push provider -> /provider/dashboard, user -> /dashboard
    // small delay so the toast is visible briefly (1200ms), adjust as desired
    setTimeout(() => {
      auth.afterLoginRedirect();
    }, 400);

  } catch (err) {
    // handle error structure from your api helper
    error.value = err?.body?.error || err?.message || "Login failed";
  }
}
</script>

<style scoped>
.fade-enter-active, .fade-leave-active { transition: opacity .2s; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
