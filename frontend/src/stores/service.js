import { defineStore } from "pinia";
import api from "../utils/api";

// normalize image array to always be [{ url, public_id }]
function normalizeImages(arr) {
  if (!arr) return [];
  if (!Array.isArray(arr)) return [];
  return arr
    .map((it) => {
      if (!it) return null;
      if (typeof it === "string") return { url: it, public_id: null };
      if (typeof it === "object") {
        const url = it.url || it.secure_url || "";
        const public_id = it.public_id || it.publicId || null;
        if (!url) return null;
        return { url, public_id };
      }
      return null;
    })
    .filter(Boolean);
}

export const useServicesStore = defineStore("services", {
  state: () => ({
    items: [],       // list of services (current page)
    total: 0,
    page: 1,
    limit: 12,
    totalPages: 1,
    loadingList: false,
    loadingItem: false,
    current: null,   // single service
    error: null
  }),

  actions: {
    // fetch list of services
    async fetchList(params = {}) {
      this.loadingList = true;
      this.error = null;
      try {
        const page = params.page ?? this.page;
        const limit = params.limit ?? this.limit;

        const qs = new URLSearchParams();
        qs.set("page", page);
        qs.set("limit", limit);
        if (params.q) qs.set("q", params.q);
        // city removed intentionally
        if (params.category) qs.set("category", params.category);
        if (params.tag) qs.set("tag", params.tag);
        if (params.providerId) qs.set("providerId", params.providerId);

        const res = await api.get(`/services?${qs.toString()}`);
        const body = res.body ?? res;

        this.items = (body.items ?? []).map(svc => ({
          ...svc,
          images: normalizeImages(svc.images)
        }));

        this.total = body.total ?? this.items.length;
        this.page = body.page ?? page;
        this.limit = body.limit ?? limit;
        this.totalPages = body.totalPages ?? Math.max(1, Math.ceil(this.total / this.limit));

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
        const body = res.body ?? res;

        this.current = {
          ...body,
          images: normalizeImages(body.images)
        };

        this.loadingItem = false;
        return this.current;
      } catch (err) {
        this.loadingItem = false;
        this.error = err?.message || "Failed to load service";
        throw err;
      }
    },

    // start chat helper
    async startChatWithProvider(providerId, serviceId) {
      try {
        const res = await api.post("/chats", { providerId, serviceId });
        return res.body;
      } catch (err) {
        throw err;
      }
    }
  }
});
