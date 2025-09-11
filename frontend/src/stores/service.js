// src/stores/services.js
import { defineStore } from "pinia";
import api from "../utils/api";

export const useServicesStore = defineStore("services", {
  state: () => ({
    items: [],           // list of services (current page)
    total: 0,            // optional total if backend provides
    page: 1,
    limit: 12,
    totalPages: 1,
    loadingList: false,
    loadingItem: false,
    current: null,       // loaded single service
    error: null
  }),
  actions: {
    // helper to build query string from params
    _buildQuery(params = {}) {
      const p = { page: this.page, limit: this.limit, ...params };
      const qs = new URLSearchParams();
      Object.entries(p).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") qs.append(k, v);
      });
      return qs.toString() ? `?${qs.toString()}` : "";
    },

    // fetch list of services (supports filters like city, q, category, page, limit)
    async fetchList(params = {}) {
      this.loadingList = true;
      this.error = null;
      try {
        // merge params with store defaults
        const page = params.page ?? this.page;
        const limit = params.limit ?? this.limit;
        const qs = new URLSearchParams();
        qs.set("page", page);
        qs.set("limit", limit);
        if (params.q) qs.set("q", params.q);
        if (params.city) qs.set("city", params.city);
        if (params.category) qs.set("category", params.category);

        const res = await api.get(`/services?${qs.toString()}`);
        const body = res.body ?? res;
        // expect { items, total, page, limit, totalPages }
        this.items = body.items ?? [];
        this.total = body.total ?? this.items.length;
        this.page = body.page ?? page;
        this.limit = body.limit ?? limit;
        this.totalPages = body.totalPages ?? Math.ceil(this.total / this.limit);
        this.loadingList = false;
        return this.items;
      } catch (err) {
        this.loadingList = false;
        this.error = err?.message || "Failed to load services";
        throw err;
      }
    },

    // fetch single service by id
    async fetchService(id) {
      this.loadingItem = true;
      this.error = null;
      try {
        const res = await api.get(`/services/${id}`);
        // expect res.body to be the service object or { service: {...} }
        const body = res.body ?? res;
        this.current = body?.service ?? body;
        this.loadingItem = false;
        return this.current;
      } catch (err) {
        this.loadingItem = false;
        this.error = err?.message || "Failed to load service";
        throw err;
      }
    },

    // simple helper to create a chat with provider (backend must implement)
    async startChatWithProvider(providerId, serviceId) {
      try {
        const res = await api.post("/chats", { providerId, serviceId });
        // expect res.body.chatId or res.body._id or entire chat object
        return res.body;
      } catch (err) {
        throw err;
      }
    }
  }
});
