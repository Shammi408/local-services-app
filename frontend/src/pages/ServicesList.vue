<template>
  <div class="page">
    <div class="toolbar">
      <input v-model="q" @keyup.enter="search" class="input" placeholder="Search services..." />
      <input v-model="city" @keyup.enter="search" class="input small" placeholder="City" />
      <button class="btn" @click="search">Search</button>
      <div style="flex:1"></div>
      <div class="small muted">Showing {{ store.items.length }} of {{ store.total }}</div>
    </div>

    <div v-if="store.loadingList" class="grid">
      <div v-for="n in 6" :key="n" class="card skeleton">Loading…</div>
    </div>

    <div v-else>
      <div v-if="store.items.length === 0" class="empty">
        No services found. Try a different city or search term.
      </div>

      <div class="grid">
        <ServiceCard v-for="svc in store.items" :key="svc._id" :service="svc" />
      </div>

      <div class="pager">
        <button class="btn" :disabled="page <= 1" @click="changePage(page - 1)">Prev</button>

        <template v-for="p in pagesToShow">
          <button
            :key="p"
            class="btn"
            :class="{ active: p === page }"
            @click="changePage(p)"
            v-if="p !== 'gap'"
          >
            {{ p }}
          </button>
          <span v-else class="ellipsis">…</span>
        </template>

        <button class="btn" :disabled="page >= store.totalPages" @click="changePage(page + 1)">Next</button>
      </div>
    </div>

    <div v-if="store.error" class="error small" style="color:crimson">{{ store.error }}</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useServicesStore } from "../stores/service";
import ServiceCard from "../components/ServiceCard.vue";

const store = useServicesStore();
const router = useRouter();
const route = useRoute();

// query-backed state
const q = ref(route.query.q ?? "");
const city = ref(route.query.city ?? "");
// Parenthesize when mixing ?? with || to avoid JS syntax error
const page = ref(Number((route.query.page ?? store.page) || 1));
const limit = ref(Number((route.query.limit ?? store.limit) || 12));
const providerId = ref(route.query.providerId ?? null);

const placeholder = "/placeholder-service.png";

function truncate(s, n = 120) {
  if (!s) return "";
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}

async function load(params = {}) {
  // merge defaults from local refs and passed-in overrides
  const p = {
    page: page.value,
    limit: limit.value,
    q: q.value?.trim() || undefined,
    city: city.value?.trim() || undefined,
    providerId: providerId.value || undefined,
    ...params,
  };

  // remove undefined keys so backend receives only provided params
  Object.keys(p).forEach((k) => p[k] === undefined && delete p[k]);

  try {
    await store.fetchList(p);
  } catch (e) {
    console.error(e);
  }
}

function setQueryInUrl() {
  // keep minimal query in URL for share/back-forward
  const qparams = {};
  if (q.value) qparams.q = q.value;
  if (city.value) qparams.city = city.value;
  if (providerId.value) qparams.providerId = providerId.value;
  if (page.value && page.value !== 1) qparams.page = String(page.value);
  if (limit.value && limit.value !== store.limit) qparams.limit = String(limit.value);

  // use replace so we don't spam history when user types
  router.replace({ path: route.path, query: qparams }).catch(() => {});
}

function search() {
  page.value = 1;
  setQueryInUrl();
  load();
}

function changePage(p) {
  if (p < 1 || p > store.totalPages) return;
  page.value = p;
  setQueryInUrl();
  load();
}

function changeLimit(l) {
  limit.value = l;
  page.value = 1;
  setQueryInUrl();
  load();
}

onMounted(() => {
  // initial load uses route.query values already set above
  load();
});

// if the route's query changes externally (back/forward or external link), react
watch(
  () => route.query,
  (qnew) => {
    q.value = qnew.q ?? "";
    city.value = qnew.city ?? "";
    providerId.value = qnew.providerId ?? null;
    page.value = Number(qnew.page ?? store.page ?? 1);
    limit.value = Number(qnew.limit ?? store.limit ?? 12);
    load();
  }
);

// keep local store.page in sync (in case store updates page)
watch(
  () => store.page,
  (v) => {
    if (v) page.value = v;
  }
);

/* pagination helper: show small window of pages with gaps */
const pagesToShow = computed(() => {
  const total = store.totalPages || 1;
  const current = page.value || 1;
  const pages = [];
  const left = Math.max(1, current - 2);
  const right = Math.min(total, current + 2);

  if (left > 1) pages.push(1);
  if (left > 2) pages.push("gap");

  for (let p = left; p <= right; p++) pages.push(p);

  if (right < total - 1) pages.push("gap");
  if (right < total) pages.push(total);

  return pages;
});
</script>

<style scoped>
/* keep existing styles from previous ServicesList (pager + .active) */
/* inside ServicesList.vue <style scoped> - replace thumb block */
.thumb {
  height: 180px;               /* fixed card preview height */
  overflow: hidden;
  border-radius: 8px;
  background: #eef6fb;
  display:flex; align-items:center; justify-content:center;
  box-shadow: 0 6px 20px rgba(2,6,23,0.06);
}
.thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;          /* important: crops to fill area */
  display: block;
  border-radius: 8px;
}
.card { 
  background: white;          /* show white cards on page bg */
  padding: 12px;
  border-radius: 10px;
  box-shadow: 0 6px 20px rgba(2,6,23,0.06);
  color: var(--text);
}
.title { font-size:18px; color: #0b1220; font-weight:700; margin-bottom:6px; }
.meta { color: var(--muted); font-size:13px; display:flex; justify-content:space-between; gap:8px; }
.desc { color:#344054; margin-top:8px; }
.card.clickable:hover { transform: translateY(-6px); transition: transform .15s ease; }

.pager .btn.active { background:#0ea5e9; }
.ellipsis { padding:8px 10px; color:#9aa2b2; }
</style>
