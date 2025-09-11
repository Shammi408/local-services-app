// src/router/index.js
import { createRouter, createWebHistory } from "vue-router";

// static imports (core pages)
import Home from "../pages/Home.vue";
import About from "../pages/About.vue";
import LoginPage from "../pages/LoginPage.vue";
import SignupPage from "../pages/SignupPage.vue";
import ServicesList from "../pages/ServicesList.vue";
import ServiceDetail from "../pages/ServiceDetail.vue";
import BookingsPage from "../pages/BookingsPage.vue";
import ProfilePage from "../pages/ProfilePage.vue";
import MyServices from "../pages/MyServices.vue";
import CreateService from "../pages/CreateService.vue";
import ServiceEdit from "../pages/ServiceEdit.vue";

// public provider profile (read-only) — create this file at src/pages/ProviderProfile.vue
import ProviderProfile from "../pages/ProviderProfile.vue";

const routes = [
  { path: "/", component: Home },
  { path: "/about", component: About },

  // Auth
  { path: "/login", component: LoginPage, meta: { noNav: true } },
  { path: "/signup", component: SignupPage, meta: { noNav: true } },

  // Services list & filters (public)
  { path: "/services", component: ServicesList },

  // Service detail (dynamic)
  { path: "/services/:id", component: ServiceDetail, props: true },

  // Bookings (requires login)
  { path: "/bookings", component: BookingsPage },

  // Profile (own editable)
  { path: "/profile", component: ProfilePage },

  // Public provider profile (read-only)
  { path: "/profile/:id", component: ProviderProfile, props: true },

 // provider routes (protected)
  { path: "/services/new", component: CreateService, meta: { requiresAuth: true, requiresProvider: true, requiresVerified: true } },
  { path: "/my-services", component: MyServices, meta: { requiresAuth: true, requiresProvider: true, requiresVerified: true } },
  { path: "/services/:id/edit", component: ServiceEdit, meta: { requiresAuth: true, requiresProvider: true } },

  {
    path: "/provider/dashboard",
    component: () => import("../pages/ProviderDashboard.vue"),
    meta: { requiresAuth: true, requiresProvider: true }
  },
  {
    path: "/provider/bookings",
    component: () => import("../pages/ProviderBookings.vue"),
    meta: { requiresAuth: true, requiresProvider: true }
  },
  {
    path: "/provider/services",
    component: () => import("../pages/ProviderServices.vue"),
    meta: { requiresAuth: true, requiresProvider: true }
  },
  {
  path: "/services/:id/book",
  component: () => import("../pages/ServiceBook.vue"),
  props: true
  },
  {
  path: "/admin",
  component: () => import("../pages/AdminDashboard.vue"),
  meta: { requiresAuth: true, requiresAdmin: true }
  },
  // {
  // path: "/admin/users",
  // component: () => import("../pages/AdminUsers.vue"),
  // meta: { requiresAuth: true, requiresAdmin: true }
  // },

  // Catch-all (redirect to services or replace with NotFound page)
  { path: "/:pathMatch(.*)*", redirect: "/services" },

];

export default createRouter({
  history: createWebHistory(),
  routes,
});
