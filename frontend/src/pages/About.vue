<template>
  <div class="about-page">
    <!-- HERO -->
    <section class="hero">
      <h1>About LocalServe</h1>
      <p>Connecting communities with trusted local service providers — all in one platform.</p>
    </section>

    <!-- OUR MISSION -->
    <section class="mission">
      <h2>Our Mission</h2>
      <p>
        At <strong>LocalServe</strong>, we believe in empowering communities by making it
        easy to find and book reliable services. From plumbers and electricians to tutors
        and cleaners, we aim to simplify life with a platform built on trust,
        transparency, and convenience.
      </p>
    </section>

    <!-- WHAT WE PROMISE -->
    <section class="promises">
      <h2>What We Promise</h2>
      <div class="grid">
        <div class="promise">
          <h3>✅ Trust & Safety</h3>
          <p>All providers are ID-verified, and user reviews keep our community accountable.</p>
        </div>
        <div class="promise">
          <h3>✅ Fair Pricing</h3>
          <p>No hidden charges — you pay only what you see when booking.</p>
        </div>
        <div class="promise">
          <h3>✅ Secure Payments</h3>
          <p>Powered by Razorpay/Stripe with multiple options: UPI, cards, wallets.</p>
        </div>
        <div class="promise">
          <h3>✅ Support That Cares</h3>
          <p>24/7 helpdesk for disputes, queries, or emergencies.</p>
        </div>
      </div>
    </section>

    <!-- COMMUNITY -->
    <section class="community">
      <h2>Our Community</h2>
      <p>
        Over <strong>200+ users</strong> and <strong>50+ providers</strong> have already
        joined LocalServe. Together, we’re building a platform where trust and service
        excellence thrive.
      </p>
    </section>

    <!-- CTA -->
    <section class="cta">
      <h2>Be Part of the LocalServe Community</h2>
      <router-link to="/services" class="btn">Explore Services</router-link>
      <router-link to="/signup" class="btn secondary">Join as a Provider</router-link>
    </section>

    <!-- CONTACT (placed at bottom of same About page) -->
    <section class="contact" id="contact" style="margin-top:40px">
      <h2>Contact Us</h2>
      <p>If you have a question, bug report, or need support — send us a message and we'll respond quickly.</p>

      <!-- show form only if not locked -->
      <form
        v-if="!isLocked"
        class="contact-form"
        @submit.prevent="submitForm"
        novalidate
      >
        <div class="form-row">
          <label for="name">Name</label>
          <input id="name" v-model="form.name" type="text" required />
        </div>

        <div class="form-row">
          <label for="email">Email</label>
          <input id="email" v-model="form.email" type="email" required />
        </div>

        <div class="form-row">
          <label for="subject">Subject</label>
          <input id="subject" v-model="form.subject" type="text" required />
        </div>

        <div class="form-row">
          <label for="message">Message</label>
          <textarea id="message" v-model="form.message" rows="6" required></textarea>
        </div>

        <div style="display:flex; gap:10px; align-items:center; margin-top:8px">
          <button :disabled="loading" class="btn">
            {{ loading ? "Sending…" : "Send Message" }}
          </button>
          <button
            type="button"
            class="btn secondary"
            :disabled="loading"
            @click="resetForm"
          >
            Reset
          </button>
        </div>

        <div v-if="success" class="small success" style="color:green; margin-top:8px;">
          ✅ Message sent — we will get back to you soon.
        </div>
        <div v-if="error" class="small error" style="color:crimson; margin-top:8px;">
          {{ error }}
        </div>
      </form>

      <!-- locked state -->
      <div v-else class="locked-message" style="margin-top:20px; padding:16px; background:#f3f4f6; border-radius:8px; text-align:center;">
        ✅ We received your message. Our team will get back to you soon.  
        <br />
        <small>You may submit another message after 1 hour.</small>
      </div>
    </section>

    <Footer />
  </div>
</template>

<script setup>
import { reactive, ref, computed, onMounted } from "vue";
import api from "../utils/api";
import Footer from "../components/Footer.vue";
// reactive form state (matches your template fields)
const form = reactive({
  name: "",
  email: "",
  subject: "",
  message: ""
});

const loading = ref(false);
const success = ref(false);
const error = ref("");

// lockout config
const LOCK_DURATION_MS = 60 * 60 * 1000; // 1 hour
const LAST_KEY = "lastContactTime";

// small helper to reset the visible form fields (does not touch lockout)
function clearFormFields() {
  form.name = "";
  form.email = "";
  form.subject = "";
  form.message = "";
}

// Client-side validation
function validate() {
  if (!form.name || !form.name.trim()) return "Please enter your name.";
  if (!form.email || !form.email.trim()) return "Please enter your email.";

  // practical email regex — good balance between restrictive and permissive
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(form.email)) return "Please enter a valid email address.";

  if (!form.subject || !form.subject.trim()) return "Please add a subject.";
  if (!form.message || !form.message.trim()) return "Please enter your message.";
  return null;
}

// compute whether form should be hidden because of recent submission
const lastSubmissionTime = ref(0);
const isLocked = computed(() => {
  if (!lastSubmissionTime.value) return false;
  return (Date.now() - lastSubmissionTime.value) < LOCK_DURATION_MS;
});

// clear the lock (for testing or admin override)
function clearLock() {
  localStorage.removeItem(LAST_KEY);
  lastSubmissionTime.value = 0;
  success.value = false;
  error.value = "";
}

// call this after a successful submission to set lock
function setLock() {
  lastSubmissionTime.value = Date.now();
  localStorage.setItem(LAST_KEY, String(lastSubmissionTime.value));
}

// submission handler
async function submitForm() {
  error.value = "";
  success.value = false;

  // If locked, do not submit
  if (isLocked.value) {
    error.value = "You can only send one message per hour. Please try later.";
    return;
  }

  const v = validate();
  if (v) {
    error.value = v;
    return;
  }

  loading.value = true;
  try {
    // call your backend endpoint (expecting POST /api/support/contact)
    // your api helper returns { status, body } or throws; adapt if needed
    await api.post("/support/contact", { ...form });

    // on success, set lock and show success message
    setLock();
    success.value = true;

    // clear the visible fields
    clearFormFields();
  } catch (err) {
    console.error("Contact submit error:", err);
    // friendly message; api throws an object with body maybe
    error.value = err?.body?.error || err?.message || "Failed to send message. Please try later.";
  } finally {
    loading.value = false;
  }
}

// load existing last submission time from localStorage on mount
onMounted(() => {
  const saved = localStorage.getItem(LAST_KEY);
  if (saved) {
    lastSubmissionTime.value = Number(saved) || 0;
    // if expired, clear it
    if ((Date.now() - lastSubmissionTime.value) >= LOCK_DURATION_MS) {
      clearLock();
    } else {
      success.value = true; // show success banner while locked
    }
  }
});
</script>

<style scoped>
.about-page {
  padding: 20px;
  font-family: Arial, sans-serif;
  line-height: 1.6;
}

/* existing styles kept (hero, mission, promises, etc) */
.hero {
  text-align: center;
  padding: 40px 20px;
  background: linear-gradient(to right, #f9fafb, #eef2ff);
  border-radius: 12px;
  margin-bottom: 24px;
}
.hero h1 { font-size: 2.2rem; margin-bottom: 12px; }
.hero p { font-size: 1.1rem; color: #555; }

/* make form look consistent */
.contact {
  margin-top: 32px;
  background: #fff;
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 6px 20px rgba(2,6,23,0.04);
}
.contact h2 { margin-bottom: 8px; }
.contact p { color: #555; margin-bottom: 12px; }

.contact-form { display:flex; flex-direction:column; gap:12px; max-width:700px; }
.form-row { display:flex; flex-direction:column; gap:6px; }
.form-row label { font-weight:600; font-size:0.95rem; color:#111827; }
.form-row input, .form-row textarea {
  padding:8px 10px;
  border-radius:6px;
  border:1px solid #e6eef8;
  font-size:14px;
}
.btn { background:#2563eb; color:#fff; padding:8px 12px; border-radius:8px; border:0; cursor:pointer; }
.btn.secondary { background:transparent; border:1px solid #e6eef8; color:#0f1724; }
.small { font-size:13px; color:#6b7280; margin-left:8px; }

.success { color: #166534; margin-left:8px; }
.error { color: #b91c1c; margin-left:8px; }
</style>
