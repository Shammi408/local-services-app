// src/utils/pushClient.js
import api from "./api";

/* helper: base64 -> Uint8Array */
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

/**
 * Register service worker (returns registration).
 * Throws if service workers aren't supported.
 */
export async function ensureServiceWorkerRegistered() {
  if (!("serviceWorker" in navigator)) throw new Error("Service workers not supported in this browser");
  // prefer ready registration if available — this will register if not yet
  return await navigator.serviceWorker.register("/sw.js");
}

/**
 * Create a PushSubscription. MUST be invoked from a user gesture (click).
 * Uses backend /api/notifications/vapid (via api.get so VITE_API_BASE honored).
 */
export async function subscribeWithPermission() {
  // 1. register SW
  const reg = await ensureServiceWorkerRegistered();

  // 2. fetch VAPID public key from backend using api helper
  const vapidResp = await api.get("/notifications/vapid");
  const vapid = vapidResp?.body?.publicKey ?? vapidResp?.body ?? vapidResp;
  if (!vapid) throw new Error("VAPID key not available from server");

  // 3. request permission (must be triggered by click)
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Notification permission not granted");

  // 4. subscribe
  const sub = await reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapid)
  });

  return sub;
}

/**
 * Get existing push subscription (if any).
 */
export async function getExistingSubscription() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  const reg = await navigator.serviceWorker.ready;
  return await reg.pushManager.getSubscription();
}

/**
 * Send subscription to backend. Attempts to use api.post first so Authorization header is included.
 * Also tries fallback fetch with explicit Authorization if needed.
 *
 * Accepts either:
 *   - a PushSubscription object (with toJSON())
 *   - a plain serializable object { endpoint, keys: { p256dh, auth } }
 *
 * Server endpoint: POST /api/notifications/subscribe
 * Body format: { subscription, userId? }  (userId parsed from JWT if available)
 */
export async function sendSubscriptionToServer(subscription) {
  if (!subscription) throw new Error("subscription required");

  // Normalize/serialize subscription
  let payload;
  try {
    payload = typeof subscription.toJSON === "function" ? subscription.toJSON() : subscription;
  } catch (e) {
    // conservative fallback
    payload = {
      endpoint: subscription.endpoint,
      keys: subscription.keys || {}
    };
  }

  // parse JWT to include userId (helps server attach without auth)
  function parseJwt(token) {
    if (!token) return null;
    try {
      const p = token.split(".")[1];
      return JSON.parse(atob(p));
    } catch (e) {
      return null;
    }
  }
  const token = (() => {
    try { return localStorage.getItem("token"); } catch { return null; }
  })();
  const parsed = parseJwt(token);
  const userId = parsed?.sub ?? parsed?.userId ?? parsed?.id ?? null;

  const body = { subscription: payload, userId };

  // try api.post (adds Authorization header via api helper)
  try {
    const res = await api.post("/notifications/subscribe", body);
    return res;
  } catch (e) {
    // fallback to direct fetch with Authorization header (best-effort)
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const resp = await fetch("/api/notifications/subscribe", {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    const json = await resp.json().catch(() => null);
    if (!resp.ok) throw new Error(json?.error || "Failed to send subscription to server");
    return json;
  }
}

/**
 * Detach subscription server-side (by endpoint or by parsed userId).
 * POST /api/notifications/unsubscribe
 */
export async function detachSubscription({ endpoint = null } = {}) {
  const token = localStorage.getItem("token");
  function parseJwt(token) {
    if (!token) return null;
    try { return JSON.parse(atob(token.split(".")[1])); } catch (e) { return null; }
  }
  const parsed = parseJwt(token);
  const userId = parsed?.sub ?? parsed?.userId ?? parsed?.id ?? null;

  const body = endpoint ? { endpoint } : { userId };
  try {
    const res = await api.post("/notifications/unsubscribe", body);
    return res;
  } catch (e) {
    // fallback
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const resp = await fetch("/api/notifications/unsubscribe", {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });
    const json = await resp.json().catch(() => null);
    return json;
  }
}
