<template>
  <div id="app" class="min-h-screen flex flex-col">
    <!-- Global navbar, hidden for certain pages via route meta -->
    <NavBar v-if="!route.meta?.noNav" />

    <!-- Debug/auth info (optional, remove or hide in production) -->
    <div class="bg-gray-100 px-4 py-2 text-sm border-b" v-if="auth.user">
      Logged in as <strong>{{ auth.user.name }}</strong>
      (role: <strong>{{ auth.user.role }}</strong>)
    </div>

    <!-- Main content -->
    <main class="flex-1">
      <router-view />
    </main>
  </div>
</template>

<script setup>
import { onMounted } from "vue";
import { useRoute } from "vue-router";
import NavBar from "./components/Navbar.vue";
import { useAuthStore } from "./stores/auth"; // either .js or not is fine

const auth = useAuthStore();
const route = useRoute();

onMounted(() => {
  // If there's a token saved but no user loaded (page refresh), fetch current user
  // (fetchMe handles clearing invalid tokens inside the store)
  if (!auth.user && auth.token) {
    auth.fetchMe().catch(() => {
      // ignore — fetchMe will logout/clear token on failure
    });
  }
});
</script>

<style>
/* If Tailwind isn't installed you can replace these with your own styles.
   Keeping classes here is harmless if you add Tailwind later. */
</style>
