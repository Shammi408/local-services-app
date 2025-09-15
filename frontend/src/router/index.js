// src/router/index.js
import { createRouter, createWebHistory } from "vue-router";

// Static imports (core pages)
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
import ConversationsList from "../pages/ConversationList.vue";
import ChatRoom from "../pages/ChatRoom.vue";
import ProviderProfile from "../pages/ProviderProfile.vue";

const routes = [
  // Public pages
  { path: "/", component: Home },
  { path: "/about", component: About },

  // Auth
  { path: "/login", component: LoginPage, meta: { noNav: true } },
  { path: "/signup", component: SignupPage, meta: { noNav: true } },

  // Services
  { path: "/services", component: ServicesList },
  { path: "/services/:id", component: ServiceDetail, props: true },

  // Bookings & profile
  { path: "/bookings", component: BookingsPage },
  { path: "/profile", component: ProfilePage },
  { path: "/profile/:id", component: ProviderProfile, props: true },

  // Provider protected routes
  {
    path: "/services/new",
    component: CreateService,
    meta: { requiresAuth: true, requiresProvider: true, requiresVerified: true }
  },
  {
    path: "/my-services",
    component: MyServices,
    meta: { requiresAuth: true, requiresProvider: true, requiresVerified: true }
  },
  {
    path: "/services/:id/edit",
    component: ServiceEdit,
    props: true,
    meta: { requiresAuth: true, requiresProvider: true }
  },

  // Lazily-loaded provider pages
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

  // Booking flow
  {
    path: "/services/:id/book",
    component: () => import("../pages/ServiceBook.vue"),
    props: true
  },

  // Admin
  {
    path: "/admin",
    component: () => import("../pages/AdminDashboard.vue"),
    meta: { requiresAuth: true, requiresAdmin: true }
  },

  // Messages / Chat
  {
    path: "/messages",
    name: "Messages",
    component: ConversationsList,
    meta: { requiresAuth: true }
  },
  {
    path: "/chats/:id",
    name: "ChatRoom",
    component: ChatRoom,
    meta: { requiresAuth: true }
  },

  // Notifications (lazy)
  {
    path: "/notifications",
    name: "Notifications",
    component: () => import("../pages/NotificationsPage.vue")
  },

  // Catch-all (redirect to services)
  { path: "/:pathMatch(.*)*", redirect: "/services" }
];

export default createRouter({
  history: createWebHistory(),
  routes
});
