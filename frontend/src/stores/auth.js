// src/stores/auth.js
import { defineStore } from "pinia";
import api from "../utils/api";
import router from "../router"; // used for redirects after login/logout

export const useAuthStore = defineStore("auth", {
  state: () => ({
    user: null,
    token: localStorage.getItem("token") || null,
    loading: false,
  }),

  // Add getters so Navbar can read these reactively
  getters: {
    isLoggedIn: (state) => !!state.token,
    role: (state) => state.user?.role ?? null,
  },

  actions: {
    setToken(t) {
      this.token = t;
      if (t) localStorage.setItem("token", t);
      else localStorage.removeItem("token");
      // also update api helper's storage so it uses same token on next requests
      api._setLocalToken(t);
    },

    // convenience: set both user + token after login/register
    setAuth(user, token) {
      if (token) this.setToken(token);
      this.user = user ?? this.user;
    },

    async fetchMe() {
      // try /auth/me to get current user (protected route)
      if (!this.token) return null;
      this.loading = true;
      try {
        const res = await api.get("/auth/me");
        // api returns { status, body }
        this.user = res.body?.user ?? res.body;
        this.loading = false;
        return this.user;
      } catch (err) {
        this.loading = false;
        // if 401, api's request will have attempted refresh (see api.js). If refresh failed, clear token.
        this.logout();
        throw err;
      }
    },

    async login(email, password) {
      this.loading = true;
      try {
        const res = await api.post("/auth/login", { email, password });
        // expect backend returns { user: {...}, accessToken: '...' }
        const acc = res.body?.accessToken || res.body?.token || res.body?.access_token;
        if (acc) this.setToken(acc);
        if (res.body?.user) this.user = res.body.user;
        else {
          // if user is not included, fetch me
          await this.fetchMe();
        }
        this.loading = false;
        return this.user;
      } catch (err) {
        this.loading = false;
        throw err;
      }
    },

    async register(payload) {
      // payload: { name, email, password, role }
      this.loading = true;
      try {
        const res = await api.post("/auth/register", payload);
        // backend registers and returns { user, accessToken } based on your code
        const acc = res.body?.accessToken || res.body?.token || res.body?.access_token;
        if (acc) this.setToken(acc);
        if (res.body?.user) this.user = res.body.user;
        else await this.fetchMe();
        this.loading = false;
        return this.user;
      } catch (err) {
        this.loading = false;
        throw err;
      }
    },

    async logout() {
      // call server logout to clear refresh cookie if you have endpoint
      try {
        await api.post("/auth/logout"); // ignore errors
      } catch (e) {}
      this.user = null;
      this.setToken(null);
      // redirect to homepage so Navbar updates visually
      try {
        router.push("/");
      } catch (e) {
        // ignore (defensive)
      }
    },

    /** helper to try refresh manually (optional) */
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

    /**
     * Helper for login flow: call after setAuth to redirect user to the right dashboard.
     * Use in LoginPage.vue after successful login or register: auth.setAuth(user, token); auth.afterLoginRedirect();
     */
    afterLoginRedirect() {
      if (!this.user) return router.push("/");
      if (this.user.role === "provider") return router.push("/provider/dashboard");
      // default for normal users
      return router.push("/dashboard");
    },
  },
});
