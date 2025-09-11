<template>
  <nav class="site-nav">
    <div class="nav-inner">
      <!-- Left: logo + primary links -->
      <div class="nav-left">
        <router-link to="/" class="logo">LocalServe</router-link>
        <div class="nav-links">
          <router-link to="/" class="nav-link">Home</router-link>
          <router-link to="/services" class="nav-link">Services</router-link>
          <router-link v-if="isProvider" to="/provider/dashboard" class="nav-link">Dashboard</router-link>

        </div>
      </div>

      <!-- Right: auth area -->
      <div class="nav-right">
        <!-- not logged in -->
        <template v-if="!isLoggedIn">
          <router-link to="/login" class="nav-link">Login</router-link>
          <router-link to="/register" class="btn-register">Register</router-link>
        </template>

        <!-- logged in -->
        <template v-else>
          <span class="user-badge">{{ auth.user.name }} <small class="muted">({{ auth.user.role }})</small></span>

          <div class="dropdown-wrap" ref="dropdownWrap">
            <button class="menu-btn" @click="toggleDropdown" aria-haspopup="true" :aria-expanded="dropdownOpen">
              Menu
              <svg class="chev" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"><path d="M6 9l6 6 6-6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>

            <div v-if="dropdownOpen" class="dropdown">
              <router-link v-if="isProvider" to="/provider/bookings" class="dropdown-item">Upcoming Bookings</router-link>
              <router-link v-if="isProvider" to="/provider/services" class="dropdown-item">My Services</router-link>

              <router-link v-if="isUser" to="/bookings" class="dropdown-item">My Bookings</router-link>
              <router-link v-if="isUser" to="/profile" class="dropdown-item">Profile</router-link>

              <button @click="logout" class="dropdown-item danger">Logout</button>
            </div>
          </div>
        </template>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useAuthStore } from "../stores/auth";
import { useRoute } from "vue-router";

const auth = useAuthStore();
const route = useRoute();

const dropdownOpen = ref(false);

const isLoggedIn = computed(() => !!auth.user);
const isProvider = computed(() => auth.user?.role === "provider");
const isUser = computed(() => auth.user?.role === "user");

function toggleDropdown() {
  dropdownOpen.value = !dropdownOpen.value;
}

function closeDropdown() {
  dropdownOpen.value = false;
}

function logout() {
  closeDropdown();
  auth.logout();
}

// click-outside to close dropdown
let onDocClick = (e) => {
  const wrap = document.querySelector(".dropdown-wrap");
  if (!wrap) return;
  if (!wrap.contains(e.target)) dropdownOpen.value = false;
};

onMounted(() => document.addEventListener("click", onDocClick));
onBeforeUnmount(() => document.removeEventListener("click", onDocClick));

// Close dropdown on route change (nice UX)
onMounted(() => {
  // watch route changes simply by listening to popstate; lightweight
  window.addEventListener("popstate", closeDropdown);
});
onBeforeUnmount(() => window.removeEventListener("popstate", closeDropdown));
</script>

<style scoped>
/* keep scoped but simple - this will work even without Tailwind */

/* nav shell */
.site-nav {
  background: white;
  border-bottom: 1px solid rgba(0,0,0,0.08);
  box-shadow: 0 1px 0 rgba(0,0,0,0.02);
  position: sticky;
  top: 0;
  z-index: 40;
}

/* inner container */
.nav-inner {
  max-width: var(--container-width, 1100px);
  margin: 0 auto;
  padding: 0.5rem 1rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

/* left cluster */
.nav-left {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}

/* logo */
.logo {
  font-weight: 700;
  font-size: 1.125rem;
  color: #2563eb;
  text-decoration: none;
}

/* links group */
.nav-links {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.nav-link {
  color: #0f1724;
  text-decoration: none;
  padding: 6px 8px;
  border-radius: 6px;
}
.nav-link:hover { background: rgba(37,99,235,0.06); color: #1e3a8a; }

/* right cluster */
.nav-right {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

/* register button style */
.btn-register {
  background: #2563eb;
  color: white;
  padding: 6px 10px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
}

/* user badge */
.user-badge {
  font-size: 0.95rem;
  color: #0f1724;
}

/* dropdown container */
.dropdown-wrap {
  position: relative;
}

/* menu button */
.menu-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 6px;
  border: 1px solid rgba(15,23,36,0.06);
  background: #f3f4f6;
  cursor: pointer;
}
.menu-btn .chev { opacity: 0.8; }

/* dropdown panel (absolute, anchored to the right of its wrap) */
.dropdown {
  position: absolute;
  right: 0;
  top: calc(100% + 8px);
  min-width: 180px;
  background: white;
  border: 1px solid rgba(2,6,23,0.06);
  box-shadow: 0 6px 18px rgba(2,6,23,0.06);
  border-radius: 8px;
  overflow: hidden;
  z-index: 60;
}

/* dropdown items */
.dropdown-item {
  display: block;
  padding: 10px 12px;
  text-align: left;
  color: #0f1724;
  text-decoration: none;
  border-bottom: 1px solid rgba(0,0,0,0.03);
}
.dropdown-item:hover { background: #f8fafc; }
.dropdown-item.danger { color: #b91c1c; border-bottom: none; }

/* small muted helper */
.muted { color: #6b7280; font-size: 0.85rem; }

/* responsive tweaks */
@media (max-width: 720px) {
  .nav-inner { padding-left: 0.75rem; padding-right: 0.75rem; }
  .nav-links { display: none; } /* hide primary links on very small screens (optional) */
}
</style>
