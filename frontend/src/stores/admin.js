// src/stores/admin.js
import { defineStore } from "pinia";
import api from "../utils/api";

export const useAdminStore = defineStore("admin", {
  state: () => ({
    stats: null,
    users: { items: [], total: 0, page:1, limit:20 },
    services: { items: [], total: 0 },
    bookings: { items: [], total: 0 },
    loading: false,
    error: null
  }),
  actions: {
    async fetchStats() {
      this.loading = true; this.error = null;
      try {
        const res = await api.get("/admin/stats");
        this.stats = res.body ?? res;
      } catch (err) {
        this.error = err?.message || "Failed to fetch stats";
        throw err;
      } finally { this.loading = false; }
    },

    async fetchUsers(params = {}) {
      const qs = new URLSearchParams(params).toString();
      const res = await api.get(`/admin/users${qs?`?${qs}`:""}`);
      const body = res.body ?? res;
      this.users = body;
      return body;
    },

    async verifyUser(id, isVerified) {
      const res = await api.patch(`/admin/users/${id}/verify`, { isVerified });
      return res.body ?? res;
    },

    async deleteService(id) {
      await api.del(`/admin/services/${id}`);
    },

    async fetchBookings(params = {}) {
      const qs = new URLSearchParams(params).toString();
      const res = await api.get(`/admin/bookings${qs?`?${qs}`:""}`);
      this.bookings = res.body ?? res;
      return this.bookings;
    }
  }
});
