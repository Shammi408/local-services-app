<template>
  <div class="home-page">
    <!-- HERO SECTION -->
    <section class="hero">
      <div class="hero-content">
        <h1>Find Trusted Local Services Near You</h1>
        <p>
          Book plumbers, electricians, cleaners, tutors, and more —
          verified professionals, fair pricing, and reliable service.
        </p>
        <div class="cta-buttons">
          <router-link to="/services" class="btn">Search Services</router-link>
          <router-link to="/signup" class="btn secondary">
            Become a Provider
          </router-link>
        </div>
      </div>

      <div class="hero-image" aria-hidden="true">
        <img :src="heroImg" alt="Local services" />
      </div>
    </section>

    <!-- HOW IT WORKS -->
    <section class="how-it-works">
      <h2>How It Works</h2>
      <div class="steps">
        <div class="step">
          <img :src="searchImg" alt="Discover" />
          <h3>Discover</h3>
          <p>Browse services by category, ratings, or location.</p>
        </div>
        <div class="step">
          <img :src="calendarImg" alt="Book" />
          <h3>Book</h3>
          <p>Pick a time that works for you and confirm instantly.</p>
        </div>
        <div class="step">
          <img :src="paymentImg" alt="Pay securely" />
          <h3>Pay Securely</h3>
          <p>Use UPI, cards, or wallets — all payments are safe.</p>
        </div>
        <div class="step">
          <img :src="checkImg" alt="Get it done" />
          <h3>Get it Done</h3>
          <p>Relax while our verified providers handle the job.</p>
        </div>
      </div>
    </section>

    <!-- FEATURED CATEGORIES -->
    <section class="categories">
      <h2>Popular Categories</h2>
      <div class="grid">
        <div class="cat-card">
          <img :src="plumbingImg" alt="Plumbing" />
          <p>Plumbing</p>
        </div>
        <div class="cat-card">
          <img :src="electricianImg" alt="Electrician" />
          <p>Electrician</p>
        </div>
        <div class="cat-card">
          <img :src="cleaningImg" alt="Cleaning" />
          <p>Cleaning</p>
        </div>
        <div class="cat-card">
          <img :src="tutorImg" alt="Tutoring" />
          <p>Tutoring</p>
        </div>
      </div>
    </section>

    <!-- WHY CHOOSE US -->
    <section class="why-us">
      <h2>Why Choose LocalServe?</h2>
      <ul>
        <li>✅ Verified Providers – All professionals are ID-verified.</li>
        <li>✅ Transparent Pricing – No hidden charges.</li>
        <li>✅ Secure Payments – Powered by Razorpay/Stripe.</li>
        <li>✅ 24/7 Support – Help desk & dispute resolution.</li>
      </ul>
    </section>

    <!-- CALL TO ACTION -->
    <section class="cta-final">
      <h2>Ready to book your first service?</h2>
      <router-link to="/services" class="btn">Explore Services</router-link>
    </section>
    <Footer />
  </div>
</template>

<script setup>
import heroImg from "../assets/home/placeholder-hero.png";
import searchImg from "../assets/home/placeholder-search.png";
import calendarImg from "../assets/home/placeholder-calendar.png";
import paymentImg from "../assets/home/placeholder-payment.png";
import checkImg from "../assets/home/placeholder-check.png";

import plumbingImg from "../assets/home/placeholder-plumbing.jpg";
import electricianImg from "../assets/home/placeholder-electrician.jpg";
import cleaningImg from "../assets/home/placeholder-cleaning.jpg";
import tutorImg from "../assets/home/placeholder-tutor.jpg";
import Footer from "../components/Footer.vue";
</script>

<style scoped>
.home-page {
  font-family: Arial, sans-serif;
  padding: 20px;
}

/* HERO */
.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 32px;
  background: linear-gradient(to right, #f9fafb, #eef2ff);
  padding: 36px;
  border-radius: 12px;
  margin-bottom: 40px;
  flex-wrap: wrap; /* allow stacking on small screens */
}

/* left content (text) */
.hero-content {
  flex: 1 1 320px;
  min-width: 260px;
}
.hero-content h1 {
  font-size: 2.2rem;
  margin-bottom: 12px;
  line-height: 1.15;
}
.hero-content p {
  color: #555;
  margin-bottom: 18px;
  font-size: 1rem;
}

/* CTA buttons */
.cta-buttons {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.btn {
  background: #2563eb;
  color: white;
  padding: 10px 16px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
}
.btn.secondary {
  background: transparent;
  border: 1px solid #2563eb;
  color: #2563eb;
}

/* right: hero image */
.hero-image {
  flex: 0 0 420px; /* allow it to grow/shrink but cap base width */
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 220px;
}
.hero-image img {
  width: 100%;
  max-width: 420px;   /* prevent it from growing too big */
  height: auto;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(2,6,23,0.06);
  object-fit: cover;
}

/* HOW IT WORKS */
.how-it-works {
  text-align: center;
  margin-bottom: 40px;
}
.steps {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 28px;
  margin-top: 20px;
}
.step img {
  width: 96px;        /* constrained icon size */
  height: 96px;
  object-fit: cover;
  margin-bottom: 12px;
  border-radius: 8px;
}

/* CATEGORIES */
.categories {
  margin-bottom: 40px;
}
.categories .grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 24px;
  margin-top: 20px;
}
.cat-card {
  text-align: center;
  background: #fff;
  border-radius: 12px;
  padding: 18px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.06);
  transition: transform 0.18s ease, box-shadow 0.18s ease;
}
.cat-card:hover {
  transform: translateY(-6px);
  box-shadow: 0 10px 24px rgba(0,0,0,0.08);
}
.cat-card img {
  width: 100%;
  max-width: 140px;  /* prevent huge images */
  height: 140px;
  object-fit: cover;
  border-radius: 8px;
  margin-bottom: 10px;
}

/* WHY US */
.why-us {
  background: #f9fafb;
  padding: 30px;
  border-radius: 10px;
  margin-bottom: 40px;
}
.why-us h2 {
  margin-bottom: 12px;
}
.why-us ul {
  list-style: none;
  padding: 0;
}
.why-us li {
  margin: 8px 0;
  font-size: 15px;
}

/* FINAL CTA */
.cta-final {
  text-align: center;
  padding: 32px;
  background: linear-gradient(to right, #2563eb, #1d4ed8);
  color: white;
  border-radius: 12px;
}
.cta-final h2 {
  margin-bottom: 16px;
}

/* Responsive tweaks */
@media (max-width: 920px) {
  .hero {
    padding: 28px;
  }
  .hero-content h1 { font-size: 1.8rem; }
  .hero-image { flex-basis: 320px; }
}
@media (max-width: 560px) {
  .hero {
    padding: 18px;
  }
  .hero-content h1 { font-size: 1.6rem; }
  .hero-image { flex-basis: 100%; margin-top: 12px; }
  .hero-image img { max-width: 100%; }
}
</style>
