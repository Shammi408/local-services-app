<template>
  <footer class="site-footer">
    <div class="footer-content">
      <!-- Brand -->
      <div class="footer-brand">
        <h2 class="logo">LocalServe</h2>
        <p class="tagline">Connecting communities with trusted local services</p>
      </div>

      <!-- Quick Links -->
      <div class="footer-links">
        <h3>Quick Links</h3>
        <ul>
          <li><router-link to="/">Home</router-link></li>
          <li><router-link to="/services">Services</router-link></li>
          <li><router-link to="/about">About</router-link></li>
          <li><a href="/about#contact">Contact</a></li>
        </ul>
      </div>

      <!-- Support -->
      <div class="footer-support">
        <h3>Support</h3>
        <ul>
          <li><a href="#">FAQ (Coming Soon)</a></li>
          <li><a href="#">Terms & Conditions</a></li>
          <li><a href="#">Privacy Policy</a></li>
        </ul>
      </div>

      <!-- Contact -->
      <div class="footer-contact">
        <h3>Contact Us</h3>
        <p>Email: <a href="mailto:support@localserve.com">support@localserve.com</a></p>
        <p>Phone: +91-9876543210</p>
        <div class="social-icons">
          <a href="https://facebook.com" target="_blank">Facebook</a>
          <a href="https://twitter.com" target="_blank">Twitter (X)</a>
          <a href="https://instagram.com" target="_blank">Instagram</a>
        </div>
      </div>
    </div>

    <div class="footer-bottom">
      <p>© 2025 LocalServe. All rights reserved.</p>
    </div>
  </footer>
</template>

<script setup>

</script>

<style scoped>
.site-footer {
  background: #1f2937; 
  color: #f9fafb;
  padding: 40px 20px 20px;
  margin-top: 40px;
}
.footer-content {
  max-width: 1200px;
  margin: 0 auto;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 30px;
}

.footer-brand .logo {
  font-size: 1.5rem;
  font-weight: 700;
  color: #3b82f6; /* blue */
}
.footer-brand .tagline {
  margin-top: 8px;
  color: #d1d5db;
  font-size: 0.95rem;
}

.footer-links h3,
.footer-support h3,
.footer-contact h3 {
  margin-bottom: 10px;
  font-size: 1.1rem;
  color: #f3f4f6;
}
.footer-links ul,
.footer-support ul {
  list-style: none;
  padding: 0;
}
.footer-links li,
.footer-support li {
  margin-bottom: 8px;
}
.footer-links a,
.footer-support a,
.footer-contact a {
  color: #d1d5db;
  text-decoration: none;
}
.footer-links a:hover,
.footer-support a:hover,
.footer-contact a:hover {
  color: #3b82f6;
}

.footer-contact p {
  margin: 6px 0;
}
.social-icons {
  margin-top: 10px;
  display: flex;
  gap: 12px;
}
.social-icons a {
  color: #f9fafb;
  font-size: 0.9rem;
  text-decoration: none;
  background: #374151;
  padding: 6px 10px;
  border-radius: 6px;
}
.social-icons a:hover {
  background: #3b82f6;
}

.footer-bottom {
  text-align: center;
  border-top: 1px solid #374151;
  margin-top: 20px;
  padding-top: 12px;
  font-size: 0.85rem;
  color: #9ca3af;
}
</style>
