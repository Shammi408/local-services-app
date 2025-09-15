// src/stores/auth.js
import { defineStore } from "pinia";
import api from "../utils/api";
import router from "../router";
import { getExistingSubscription, sendSubscriptionToServer, detachSubscription } from "../utils/pushClient";
import { joinSocket, setupSocketListeners } from "../utils/socket";
import { useBookingsStore } from "./bookings";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null,
    token: localStorage.getItem("token") || null,
    loading: false,
  }),

  getters: {
    isLoggedIn: (state) => !!state.token,
    role: (state) => state.user?.role ?? null,
  },

  actions: {
    setToken(t) {
      this.token = t;
      if (t) localStorage.setItem("token", t);
      else localStorage.removeItem("token");
      api._setLocalToken(t);
    },

    setAuth(user, token) {
      if (token) this.setToken(token);
      this.user = user ?? this.user;
    },

    async fetchMe() {
      if (!this.token) return null;
      this.loading = true;
      try {
        const res = await api.get("/auth/me");
        this.user = res.body?.user ?? res.body;

        // join socket and setup listeners (safe to call multiple times)
        try {
          const uid = this.user?.id ?? this.user?._id;
          if (uid) {
            joinSocket(uid);
            // attach socket listeners and wire to bookings store
            setupSocketListeners(useBookingsStore());
          }
        } catch (e) {
          console.warn("Socket join/setup after fetchMe failed", e);
        }

        this.loading = false;

        // non-blocking: attach any existing subscription (for cases user subscribed before login)
        (async () => {
          try {
            const existing = await getExistingSubscription();
            if (existing) {
              await sendSubscriptionToServer(typeof existing.toJSON === "function" ? existing : existing);
            }
          } catch (e) {
            console.warn("Push attach after fetchMe failed", e);
          }
        })();

        return this.user;
      } catch (err) {
        this.loading = false;
        this.logout();
        throw err;
      }
    },

    async login(email, password) {
      this.loading = true;
      try {
        const res = await api.post("/auth/login", { email, password });
        const acc = res.body?.accessToken || res.body?.token || res.body?.access_token;
        if (acc) this.setToken(acc);
        if (res.body?.user) {
          this.user = res.body.user;
          // join socket and setup listeners
          try {
            const uid = this.user?.id ?? this.user?._id;
            if (uid) {
              joinSocket(uid);
              setupSocketListeners(useBookingsStore());
            }
          } catch (e) {
            console.warn("Socket join/setup after login failed", e);
          }
        } else {
          await this.fetchMe(); // fetchMe will call joinSocket + setup
        }

        // try to attach subscription immediately (await so it runs now, but errors are caught)
        try {
          const existing = await getExistingSubscription();
          if (existing) {
            await sendSubscriptionToServer(typeof existing.toJSON === "function" ? existing : existing);
          }
        } catch (e) {
          console.warn("Push attach after login failed", e);
        }

        this.loading = false;
        return this.user;
      } catch (err) {
        this.loading = false;
        throw err;
      }
    },

    async register(payload) {
      this.loading = true;
      try {
        const res = await api.post("/auth/register", payload);
        const acc = res.body?.accessToken || res.body?.token || res.body?.access_token;
        if (acc) this.setToken(acc);
        if (res.body?.user) {
          this.user = res.body.user;
          try {
            const uid = this.user?.id ?? this.user?._id;
            if (uid) {
              joinSocket(uid);
              setupSocketListeners(useBookingsStore());
            }
          } catch (e) {
            console.warn("Socket join/setup after register failed", e);
          }
        } else {
          await this.fetchMe();
        }

        try {
          const existing = await getExistingSubscription();
          if (existing) {
            await sendSubscriptionToServer(typeof existing.toJSON === "function" ? existing : existing);
          }
        } catch (e) {
          console.warn("Push attach after register failed", e);
        }

        this.loading = false;
        return this.user;
      } catch (err) {
        this.loading = false;
        throw err;
      }
    },

    async logout() {
      try { await api.post("/auth/logout"); } catch (e) {}

      // best-effort server unsubscribe by userId
      try {
        const myId = this.user?.id ?? this.user?._id ?? null;
        if (myId) {
          await api.post("/notifications/unsubscribe", { userId: myId });
        } else {
          await api.post("/notifications/unsubscribe", {});
        }
      } catch (e) {
        console.warn("Server-side unsubscribe failed", e);
      }

      // attempt to unsubscribe locally and tell server to remove endpoint
      try {
        if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          if (reg) {
            const subscription = await reg.pushManager.getSubscription();
            if (subscription) {
              try {
                await api.post("/notifications/unsubscribe", { endpoint: subscription.endpoint });
              } catch (e) {}
              await subscription.unsubscribe();
            }
          }
        }
      } catch (e) {
        console.warn("Local unsubscribe failed", e);
      }

      this.user = null;
      this.setToken(null);
      try { router.push("/"); } catch (e) {}
    },

    async refreshToken() {
      try {
        const res = await api.raw("/auth/refresh", { method: "POST" }, false);
        const acc = res.body?.accessToken || res.body?.token;
        if (acc) this.setToken(acc);
        return acc;
      } catch (err) {
        this.setToken(null);
        throw err;
      }
    },

    afterLoginRedirect() {
      if (!this.user) return router.push("/");
      if (this.user.role === "provider") return router.push("/provider/dashboard");
      return router.push("/dashboard");
    },
  },
});
