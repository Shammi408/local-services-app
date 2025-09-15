<template>
  <div class="page">
    <div class="toolbar">
      <input v-model="q" @keyup.enter="search" class="input" placeholder="Search services..." />
      <button class="btn" @click="search">Search</button>
      <div style="flex:1"></div>
      <div class="small muted">Showing {{ store.items.length }} of {{ store.total }}</div>
    </div>

    <!-- Tags row -->
    <div class="tags-row" v-if="tags.length > 0">
      <span class="muted small">Tags:</span>
      <button
        v-for="t in tags"
        :key="t"
        :class="['tag-chip', { active: selectedTag === t }]"
        @click="toggleTag(t)"
      >
        {{ t }}
      </button>
      <button v-if="selectedTag" class="tag-clear" @click="clearTag">Clear</button>
    </div>

    <div v-if="store.loadingList" class="grid">
      <div v-for="n in 6" :key="n" class="card skeleton">Loading…</div>
    </div>

    <div v-else>
      <div v-if="store.items.length === 0" class="empty">
        No services found. Try a different tag or search term.
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
  <div>
    <Footer />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useServicesStore } from "../stores/service";
import ServiceCard from "../components/ServiceCard.vue";
import api from "../utils/api";
import Footer from "../components/Footer.vue";

const store = useServicesStore();
const router = useRouter();
const route = useRoute();

const q = ref(route.query.q ?? "");
const page = ref(Number((route.query.page ?? store.page) || 1));
const limit = ref(Number((route.query.limit ?? store.limit) || 12));
const providerId = ref(route.query.providerId ?? null);

const selectedTag = ref(route.query.tag ?? "");
const tags = ref([]);

async function loadTags() {
  try {
    const res = await api.get("/services/tags");
    tags.value = res.body ?? res;
  } catch (e) {
    tags.value = ["tutoring", "plumbing", "grooming", "cleaning", "handyman"];
  }
}

async function load(params = {}) {
  const p = {
    page: page.value,
    limit: limit.value,
    q: q.value?.trim() || undefined,
    providerId: providerId.value || undefined,
    tag: selectedTag.value || undefined,
    ...params,
  };
  Object.keys(p).forEach((k) => p[k] === undefined && delete p[k]);
  try {
    await store.fetchList(p);
  } catch (e) {
    console.error(e);
  }
}

function setQueryInUrl() {
  const qparams = {};
  if (q.value) qparams.q = q.value;
  if (providerId.value) qparams.providerId = providerId.value;
  if (selectedTag.value) qparams.tag = selectedTag.value;
  if (page.value && page.value !== 1) qparams.page = String(page.value);
  if (limit.value && limit.value !== store.limit) qparams.limit = String(limit.value);
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
function toggleTag(t) {
  selectedTag.value = selectedTag.value === t ? "" : t;
  page.value = 1;
  setQueryInUrl();
  load();
}
function clearTag() {
  selectedTag.value = "";
  setQueryInUrl();
  load();
}

onMounted(async () => {
  await loadTags();
  await load();
});

watch(
  () => route.query,
  (qnew) => {
    q.value = qnew.q ?? "";
    providerId.value = qnew.providerId ?? null;
    selectedTag.value = qnew.tag ?? "";
    page.value = Number(qnew.page ?? store.page ?? 1);
    limit.value = Number(qnew.limit ?? store.limit ?? 12);
    load();
  }
);

watch(
  () => store.page,
  (v) => { if (v) page.value = v; }
);

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
/* Tags row kept as before */
.tags-row { margin:12px 0; display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
.tag-chip { padding:6px 12px; border-radius:999px; border:1px solid #ddd; cursor:pointer; background:transparent; }
.tag-chip.active { background:#2563eb; color:white; border-color:#2563eb; }
.tag-clear { margin-left:6px; padding:6px 8px; border:none; background:transparent; cursor:pointer; color:#555; }

/* Responsive grid for service cards
   Mobile: 1 column
   Tablet (>=720px): 2 columns
   Desktop (>=1100px): 4 columns
*/
.grid {
  display: grid;
  gap: 16px;
  /* default mobile: 1 column */
  grid-template-columns: repeat(1, 1fr);
  align-items: start;
}

/* tablet */
@media (min-width: 720px) {
  .grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 18px;
  }
}

/* desktop */
@media (min-width: 1100px) {
  .grid {
    grid-template-columns: repeat(4, 1fr);
    gap: 20px;
  }
}

/* small responsive tweaks for pager / toolbar */
.toolbar { display:flex; gap:12px; align-items:center; margin-bottom:12px; flex-wrap:wrap; }
.input { padding:8px 10px; border-radius:8px; border:1px solid #e6eef8; }
.input.small { width:220px; }

/* empty state */
.empty { padding:24px; text-align:center; color:#6b7280; }

/* pager button active state */
.pager .btn.active { background:#111827; color:white; }

/* ensure footer spacing */
.page > div:last-child { margin-top:18px; }
</style>
