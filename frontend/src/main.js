// src/main.js
import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import "./style.css";
import api from "./utils/api";

// socket helpers (we only use setup here for the initial mount flow)
import { setupSocketListeners, joinSocket } from "./utils/socket";
import { useBookingsStore } from "./stores/bookings";
import { useAuthStore } from "./stores/auth";

const app = createApp(App);

// Pinia
const pinia = createPinia();
app.use(pinia);

// Router
app.use(router);

// Ensure API helper knows about any token saved in localStorage before any request/guards run
// (api._setLocalToken should exist in your utils/api and attach it to outgoing headers)
api._setLocalToken(localStorage.getItem("token") || null);

// Import auth after pinia (moved earlier import into top so we can reference in mount logic)
// NOTE: we import useAuthStore above to access state after mount

app.mount("#app");

// Run post-mount initialization that depends on stores (auth/bookings)
(async () => {
  try {
    const auth = useAuthStore();
    const bookings = useBookingsStore();

    // If there is a token and no user data yet, try to populate the user (this mirrors your router guard)
    if (!auth.user && auth.token) {
      try {
        // fetchMe in your auth store will call joinSocket(...) and attach subscription as before
        await auth.fetchMe();
      } catch (e) {
        // ignore: fetchMe will logout on failure
      }
    }

    // If we now have a logged-in user, ensure socket listeners are attached and we joined
    if (auth.user && (auth.user.id ?? auth.user._id)) {
      try {
        // ensure socket is connected and joined (fetchMe/login already calls joinSocket),
        // but calling joinSocket again is safe.
        joinSocket(auth.user?.id ?? auth.user?._id);
        // attach socket event listeners that update bookings store
        setupSocketListeners(bookings, {
          onBookingCreated: (b) => {
            // optional: you can show a toast or custom handling here
            // e.g., use your toast lib to show a notification
            // toast.info(`New booking: ${b._id}`);
            console.log("booking.created callback (main):", b._id);
          },
          onBookingUpdated: (b) => {
            console.log("booking.updated callback (main):", b._id);
          }
        });
      } catch (e) {
        console.warn("Socket setup after mount failed", e);
      }
    }
  } catch (err) {
    console.warn("Post-mount initialization error:", err);
  }
})();

// Router guards (existing logic)
router.beforeEach(async (to) => {
  const auth = useAuthStore();

  // Try to populate auth.user if it's not present
  if (!auth.user && auth.token) {
    try {
      await auth.fetchMe();
    } catch (e) {
      // ignore errors: fetchMe throws when not logged in or token invalid
    }
  }

  // requires login
  if (to.meta?.requiresAuth && !auth.user) {
    return { path: "/login", query: { redirect: to.fullPath } };
  }

  // requires provider role
  if (to.meta?.requiresProvider && auth.user?.role !== "provider") {
    if (!auth.user) return { path: "/login", query: { redirect: to.fullPath } };
    return { path: "/" };
  }
  // requires admin
  if (to.meta?.requiresAdmin && auth.user?.role !== "admin") {
    if (!auth.user) return { path: "/login", query: { redirect: to.fullPath } };
    return { path: "/" };
  }

  // requires provider to be verified
  if (to.meta?.requiresVerified && !auth.user?.isVerified) {
    return { path: "/profile" };
  }

  // --- Ownership check for editing a service ---
  if (to.path.match(/^\/services\/[^/]+\/edit$/)) {
    if (!auth.user) {
      return { path: "/login", query: { redirect: to.fullPath } };
    }

    const serviceId = to.params.id || (to.path.split("/")[2] ?? null);
    if (!serviceId) {
      return { path: "/my-services" };
    }

    try {
      const res = await api.get(`/services/${serviceId}`);
      const svc = res.body ?? res;

      let providerId = null;
      if (svc.providerId) {
        providerId = typeof svc.providerId === "string" ? svc.providerId : (svc.providerId._id ?? svc.providerId.id ?? null);
      } else if (svc.provider) {
        providerId = typeof svc.provider === "string" ? svc.provider : (svc.provider._id ?? svc.provider.id ?? null);
      }

      const myId = auth.user?.id ?? auth.user?._id;
      if (!providerId || !myId || providerId.toString() !== myId.toString()) {
        return { path: "/my-services" };
      }

      return true;
    } catch (err) {
      if (err?.status === 401) {
        return { path: "/login", query: { redirect: to.fullPath } };
      }
      return { path: "/my-services" };
    }
  }

  return true;
});

// Register SW once (not in guard!)
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("/sw.js")
    // .then(() => console.log("SW registered"))
    .catch((err) => console.error("SW registration failed", err));
}
