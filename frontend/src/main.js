// main.js
import { createApp } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";
import router from "./router";
import "./style.css";
import api from "./utils/api";

const app = createApp(App);

// Pinia
const pinia = createPinia();
app.use(pinia);

// Router
app.use(router);

// Ensure API helper knows about any token saved in localStorage before any request/guards run
// (api._setLocalToken should exist in your utils/api and attach it to outgoing headers)
api._setLocalToken(localStorage.getItem("token") || null);

// now router & pinia are ready — add guard
import { useAuthStore } from "./stores/auth";

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
  // Only run this for the specific edit route: /services/:id/edit
  if (to.path.match(/^\/services\/[^/]+\/edit$/)) {
    // if not logged in - redirect to login (should already be handled above by requiresAuth)
    if (!auth.user) {
      return { path: "/login", query: { redirect: to.fullPath } };
    }

    const serviceId = to.params.id || (to.path.split("/")[2] ?? null);
    if (!serviceId) {
      // malformed route: redirect to my-services
      return { path: "/my-services" };
    }

    try {
      // fetch service (backend is authoritative)
      const res = await api.get(`/services/${serviceId}`);
      const svc = res.body ?? res;

      // get provider id (handle populated object or plain id)
      let providerId = null;
      if (svc.providerId) {
        providerId = typeof svc.providerId === "string" ? svc.providerId : (svc.providerId._id ?? svc.providerId.id ?? null);
      } else if (svc.provider) {
        providerId = typeof svc.provider === "string" ? svc.provider : (svc.provider._id ?? svc.provider.id ?? null);
      }

      const myId = auth.user?.id ?? auth.user?._id;
      if (!providerId || !myId || providerId.toString() !== myId.toString()) {
        // not the owner — redirect to provider dashboard (or service page)
        return { path: "/my-services" };
      }

      // owner OK -> allow navigation
      return true;
    } catch (err) {
      // handle auth / not found / server error
      if (err?.status === 401) {
        return { path: "/login", query: { redirect: to.fullPath } };
      }
      // service not found or other error — go back to my-services
      return { path: "/my-services" };
    }
  }
  return true;
});

app.mount("#app");
