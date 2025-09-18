<template>
  <nav class="site-nav">
    <div class="nav-inner">
      <div class="nav-left">
        <router-link to="/" class="logo">LocalServe</router-link>
      </div>

      <button
        class="hamburger"
        @click="mobileOpen = !mobileOpen"
        :aria-expanded="mobileOpen ? 'true' : 'false'"
        aria-label="Toggle menu"
      >
        <span class="hamb-line" />
        <span class="hamb-line" />
        <span class="hamb-line" />
      </button>

      <div :class="['nav-links', { open: mobileOpen }]">
        <router-link to="/" class="nav-link" exact @click="closeAll">Home</router-link>
        <router-link to="/services" class="nav-link" @click="closeAll">Services</router-link>
        <router-link to="/about" class="nav-link" @click="closeAll">About</router-link>

        <router-link v-if="auth.isLoggedIn" to="/messages" class="nav-link" @click="closeAll">Messages</router-link>

        <router-link
          v-if="auth.user?.role === 'provider'"
          to="/provider/dashboard"
          class="nav-link"
          @click="closeAll"
        >
          Dashboard
        </router-link>
        <!-- admin link: only show if user is logged in and is admin -->
        <router-link v-if="auth.user?.role === 'admin'" to="/admin" class="btn admin">
          Admin Dashboard
        </router-link>
      </div>

      <div class="nav-right" ref="navRight">
        <div v-if="!auth.isLoggedIn" class="auth-actions">
          <router-link to="/login" class="btn small" @click="closeAll">Login</router-link>
          <router-link to="/signup" class="btn small outline" @click="closeAll">Register</router-link>
        </div>

        <div v-else class="user-area" ref="userDropdown">
          <!-- notification bell -->
          <NotificationBell />

          <!-- user dropdown -->
          <div class="user-dropdown-wrap" :class="{ open: open }">
            <button
              class="user-btn"
              @click.stop="toggleDropdown"
              :aria-expanded="open ? 'true' : 'false'"
              type="button"
              ref="userBtn"
            >
              <img v-if="auth.user?.profilePic" :src="auth.user.profilePic" class="user-avatar" />
              <span class="user-name" aria-hidden="true">{{ displayName }}</span>
              <span class="caret" aria-hidden="true">▾</span>
            </button>

            <div v-if="open" class="dropdown-panel" role="menu" @click.stop>
              <router-link to="/bookings" class="dropdown-item" role="menuitem" @click="closeAll">My Bookings</router-link>
              <router-link to="/profile" class="dropdown-item" role="menuitem" @click="closeAll">Profile</router-link>

              <router-link
                v-if="auth.user?.role === 'provider'"
                to="/provider/services"
                class="dropdown-item"
                role="menuitem"
                @click="closeAll"
              >
                My Services
              </router-link>

              <router-link v-if="auth.isLoggedIn" to="/messages" class="dropdown-item" role="menuitem" @click="closeAll">Messages</router-link>

              <button class="dropdown-item logout" @click="handleLogout" role="menuitem">Logout</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </nav>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from "vue";
import { useRouter } from "vue-router";
import { useAuthStore } from "../stores/auth";
import NotificationBell from "./NotificationBell.vue";

const auth = useAuthStore();
const router = useRouter();

const open = ref(false);
const mobileOpen = ref(false);

const userDropdown = ref(null);
const userBtn = ref(null);
const navRight = ref(null);

const displayName = computed(() => auth.user?.name || auth.user?.email || "Me");

function toggleDropdown() {
  open.value = !open.value;
}

function closeAll() {
  open.value = false;
  mobileOpen.value = false;
}

async function handleLogout() {
  try { await auth.logout(); } catch (e) {}
  closeAll();
  router.push("/");
}

function onDocClick(e) {
  const wrap = userDropdown.value;
  if (!wrap) return;
  if (!wrap.contains(e.target)) open.value = false;
}

function onKeyDown(e) {
  if (e.key === "Escape") { open.value = false; mobileOpen.value = false; }
}

onMounted(() => {
  document.addEventListener("click", onDocClick);
  document.addEventListener("keydown", onKeyDown);
});
onBeforeUnmount(() => {
  document.removeEventListener("click", onDocClick);
  document.removeEventListener("keydown", onKeyDown);
});
</script>

<style scoped>
.site-nav { background: white; border-bottom: 1px solid #e6e6e6; position: sticky; top: 0; z-index: 80; }
.nav-inner { max-width: 1100px; margin: 0 auto; display:flex; align-items:center; gap:12px; padding:8px 16px; position:relative; }

/* Logo */
.logo { font-weight:700; color:#2563eb; text-decoration:none; font-size:18px; flex:0 0 auto; }

/* Hamburger */
.hamburger { display:none; background:transparent; border:1px solid #e6e6e6; padding:6px; border-radius:6px; cursor:pointer; }
.hamb-line { display:block; height:2px; width:18px; background:#333; margin:3px 0; }

/* Nav links */
.nav-links { display:flex; gap:12px; align-items:center; margin-left:12px; flex:1 1 auto; }
.nav-link { color:#111827; text-decoration:none; padding:8px 10px; border-radius:6px; font-size:15px; }
.nav-link:hover { background:#f3f4f6; }

/* Right side */
.nav-right { display:flex; align-items:center; gap:8px; flex:0 0 auto; }

/* Notification and user area */
.user-area { display:flex; align-items:center; gap:8px; position:relative; }
.user-btn { display:inline-flex; gap:8px; align-items:center; border:1px solid #e6e6e6; background:white; padding:6px 10px; border-radius:8px; cursor:pointer; }
.user-avatar { width:28px; height:28px; border-radius:50%; object-fit:cover; }
.user-name { font-size:14px; color:#111827; }
.caret { color:#6b7280; font-size:12px; }

/* dropdown panel */
.user-dropdown-wrap { position: relative; }
.dropdown-panel { position:absolute; right:0; margin-top:8px; top:44px; background:white; border:1px solid #e6e6e6; box-shadow:0 10px 30px rgba(2,6,23,0.06); border-radius:8px; min-width:200px; z-index:200; overflow:hidden; }
.dropdown-item { display:block; padding:10px 12px; color:#111827; text-decoration:none; width:100%; text-align:left; border:0; background:white; }
.dropdown-item:hover { background:#f8fafc; }
.dropdown-item.logout { border-top:1px solid #eee; color:#ef4444; }

/* small */
.btn.small { padding:6px 10px; border-radius:6px; font-weight:600; }

/* Mobile */
@media (max-width: 820px) {
  .hamburger { display:inline-flex; }
  .nav-links { position:absolute; left:12px; right:12px; top:56px; background:white; border-radius:8px; border:1px solid #e6e6e6; display:none; flex-direction:column; gap:0; padding:8px; box-shadow:0 10px 30px rgba(2,6,23,0.06); z-index:150; }
  .nav-links.open { display:flex; }
  .nav-link { padding:12px 14px; border-bottom:1px solid #f1f5f9; }
  .nav-link:last-child { border-bottom:0; }
}
</style>
