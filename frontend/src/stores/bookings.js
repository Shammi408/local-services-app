// src/stores/bookings.js
import { defineStore } from "pinia";
import api from "../utils/api";

export const useBookingsStore = defineStore("bookings", {
  state: () => ({
    items: [],
    loading: false,
    loadingAction: false, // used for button-level disabling
    error: null,
  }),
  actions: {
    // Create a booking
    async createBooking(payload) {
      this.loadingAction = true;
      try {
        const res = await api.post("/bookings", payload);
        const booking = res.body ?? res;
        this.items.unshift(booking);
        this.loadingAction = false;
        return booking;
      } catch (err) {
        this.loadingAction = false;
        throw err;
      }
    },


    /**
     * Fetch bookings for current user/provider.
     * Optionally pass a status string (e.g. "upcoming", "pending", "confirmed").
     */
    async fetchBookings(status = null) {
      this.loading = true;
      this.error = null;
      try {
        const q = status ? `?status=${encodeURIComponent(status)}` : "";
        const res = await api.get(`/bookings${q}`);
        const body = res.body ?? res;
        // backend returns an array of bookings
        this.items = Array.isArray(body) ? body : body.items ?? [];
        this.loading = false;
        return this.items;
      } catch (err) {
        this.loading = false;
        this.error = err?.message || "Failed to load bookings";
        throw err;
      }
    },

    /**
     * Update booking status with optimistic UI update.
     * @param {string} bookingId
     * @param {string} status - new status to set
     * Returns updated booking on success, throws on failure.
     */
    async updateStatus(bookingId, status) {
      this.loadingAction = true;
      // find index and previous value for rollback
      const idx = this.items.findIndex((b) => (b._id ?? b.id) === bookingId);
      const prev = idx !== -1 ? { ...this.items[idx] } : null;

      // optimistic update locally
      if (idx !== -1) {
        this.items[idx] = { ...this.items[idx], status };
      }

      try {
        const res = await api.put(`/bookings/${bookingId}`, { status });
        const updated = res.body ?? res;

        // replace local item with server response to ensure consistency
        if (idx !== -1) {
          this.items[idx] = updated;
        } else {
          // if not present, push
          this.items.unshift(updated);
        }

        this.loadingAction = false;
        return updated;
      } catch (err) {
        // rollback optimistic update
        if (idx !== -1 && prev) {
          this.items[idx] = prev;
        }
        this.loadingAction = false;
        throw err;
      }
    }
  }
});
