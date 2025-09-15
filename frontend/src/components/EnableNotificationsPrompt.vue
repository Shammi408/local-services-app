<template>
  <div class="notify-prompt">
    <p class="prompt-text">Want booking updates & messages pushed to your device?</p>

    <div class="prompt-actions">
      <button class="btn" :disabled="busy" @click="enable">
        <span v-if="!busy">Enable notifications</span>
        <span v-else>Enabling…</span>
      </button>
      <button class="btn-link" @click="skip" :disabled="busy">Maybe later</button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>
  </div>
</template>

<script setup>
import { ref } from "vue";
import { subscribeWithPermission, sendSubscriptionToServer, getExistingSubscription } from "../utils/pushClient";

const emit = defineEmits(["done", "skipped"]);

const busy = ref(false);
const error = ref("");

// Attempt to enable push: register SW, request permission, create subscription, send to backend
async function enable() {
  busy.value = true;
  error.value = "";

  try {
    // If an existing subscription already exists, just attach that one
    const existing = await getExistingSubscription();
    let sub = existing;

    if (!sub) {
      // This will call Notification.requestPermission (must be triggered by the click)
      sub = await subscribeWithPermission();
    }

    if (sub) {
      // attach subscription to backend (idempotent upsert)
      await sendSubscriptionToServer(sub);
    }

    busy.value = false;
    emit("done"); // parent will redirect or hide prompt
  } catch (err) {
    // show user-friendly error, keep detailed in dev console only
    if (process.env.NODE_ENV !== "production") {
      console.error("Enable notifications failed (dev):", err);
    }
    error.value = err?.message || "Failed to enable notifications";
    busy.value = false;
  }
}

function skip() {
  emit("skipped");
}
</script>

<style scoped>
.notify-prompt {
  margin-top: 18px;
  padding: 12px;
  border-radius: 8px;
  background: #f9fafb;
  border: 1px solid #e6e6e6;
}
.prompt-text {
  margin: 0 0 8px 0;
  font-size: 14px;
  color: #111827;
}
.prompt-actions { display:flex; gap:10px; align-items:center; }
.btn {
  background: #2563eb;
  color: white;
  border: none;
  padding: 8px 12px;
  border-radius: 6px;
  cursor: pointer;
}
.btn[disabled] { opacity: 0.6; cursor: not-allowed; }
.btn-link {
  background: none;
  border: none;
  color: #2563eb;
  cursor: pointer;
  text-decoration: underline;
  padding: 6px;
}
.error { color: #b91c1c; margin-top: 8px; font-size: 13px; }
</style>
