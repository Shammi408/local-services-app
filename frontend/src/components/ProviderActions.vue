<template>
  <div class="actions">
    <router-link v-if="editLink" :to="editLink" class="btn small secondary">Edit</router-link>

    <button
      class="btn small danger"
      @click="onDelete"
      :disabled="disabled || deleting"
    >
      <span v-if="deleting">Deleting…</span>
      <span v-else>Delete</span>
    </button>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useRouter } from "vue-router";

const props = defineProps({
  service: { type: Object, required: true },
  // optionally pass an explicit edit link; otherwise component will build /services/:id/edit
  editLink: { type: String, default: null },
  // disable all actions (e.g. while parent is processing)
  disabled: { type: Boolean, default: false },
  // deleting flag to show per-row loading state
  deleting: { type: Boolean, default: false }
});

const emit = defineEmits(["delete", "edit"]);

const router = useRouter();

const computedEditLink = computed(() => {
  if (props.editLink) return props.editLink;
  return `/services/${props.service._id}/edit`;
});

function onDelete() {
  const ok = confirm(`Delete service "${props.service.title}"? This action cannot be undone.`);
  if (!ok) return;
  emit("delete", props.service._id);
}

function onEdit() {
  emit("edit", props.service._id);
  router.push(computedEditLink.value);
}
</script>

<style scoped>
.actions { display:flex; gap:8px; align-items:center; }
.btn { background:#2563eb; color:white; padding:6px 8px; border-radius:8px; border:none; cursor:pointer; text-decoration:none; }
.btn.small { padding:6px 8px; font-size:13px; }
.btn.secondary { background:transparent; border:1px solid #e6eef8; color:#0f1724; text-decoration:none; display:inline-flex; align-items:center; justify-content:center; }
.btn.danger { background:#ef4444; color:white; }
</style>
