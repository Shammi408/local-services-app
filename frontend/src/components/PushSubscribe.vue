<template>
  <div>
    <button v-if="!subscribed" class="btn" @click="subscribe">Enable notifications</button>
    <button v-else class="btn secondary" @click="unsubscribe">Disable notifications</button>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import api from "../utils/api";
import { useAuthStore } from "../stores/auth";

const auth = useAuthStore();
const subscribed = ref(false);

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/\-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function getVapidKey() {
  try {
    const res = await api.get("/notifications/vapid");
    // res.body used earlier in your code; handle both shapes
    return (res?.body?.publicKey) ?? (res?.publicKey) ?? null;
  } catch (err) {
    console.warn("Failed to fetch VAPID key", err);
    return null;
  }
}

async function subscribe() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
    alert("Push notifications are not supported in this browser.");
    return;
  }

  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") {
      alert("Please allow notifications in your browser settings.");
      return;
    }

    // ensure service worker registered
    const reg = await navigator.serviceWorker.register("/sw.js");
    const vapid = await getVapidKey();
    if (!vapid) {
      alert("VAPID public key not available on server.");
      return;
    }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid)
    });

    // send subscription to backend
    await api.post("/notifications/subscribe", {
      subscription: sub,
      userId: auth.user?.id ?? auth.user?._id ?? null
    });

    subscribed.value = true;
    alert("Subscribed to notifications!");
  } catch (err) {
    console.error("subscribe err", err);
    alert("Failed to subscribe to notifications");
  }
}

async function unsubscribe() {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return;
    const subscription = await reg.pushManager.getSubscription();
    if (subscription) {
      // inform backend and then unsubscribe locally
      await api.post("/notifications/unsubscribe", { endpoint: subscription.endpoint });
      await subscription.unsubscribe();
    } else {
      // if no subscription, try to delete by user
      if (auth.user?.id) await api.post("/notifications/unsubscribe", {});
    }
    subscribed.value = false;
    alert("Unsubscribed from notifications");
  } catch (err) {
    console.error("unsubscribe err", err);
    alert("Failed to unsubscribe");
  }
}

// check subscription status after SW ready
onMounted(async () => {
  try {
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) {
      subscribed.value = false;
      return;
    }
    const subscription = await reg.pushManager.getSubscription();
    subscribed.value = !!subscription;
  } catch (e) {
    console.warn(e);
  }
});
</script>
