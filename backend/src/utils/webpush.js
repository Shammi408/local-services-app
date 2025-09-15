import webpush from "web-push";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@localserve.example";

if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
  console.warn("VAPID keys missing. Web Push will not work until VAPID keys are set.");
} else {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

/**
 * sendWebPush(subscription, payloadObject)
 * subscription: { endpoint, keys: { p256dh, auth } }
 * payloadObject: Object - will be JSON.stringified
 */
export async function sendWebPush(subscription, payloadObject = {}) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    throw new Error("VAPID keys not configured");
  }
  const payload = JSON.stringify(payloadObject || {});
  try {
    const res = await webpush.sendNotification(subscription, payload);
    return res;
  } catch (err) {
    // web-push returns errors (e.g., 410 gone if subscription expired).
    throw err;
  }
}

export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY;
}
