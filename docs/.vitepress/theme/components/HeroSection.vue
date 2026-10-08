<template>
  <div class="hero-fullscreen">
    <div class="hero-bg" :style="{ backgroundImage: 'url(/images/hero-bg.jpg)' }"></div>
    <div class="hero-overlay"></div>
    <div class="hero-content">
      <h1 class="hero-title">
        <span class="hero-rd">RD</span> <span class="hero-studio">STUDIO</span>
      </h1>
    </div>
    <div class="hero-scroll-hint">
      <span>↓</span>
    </div>
  </div>
</template>

<script setup>
</script>

<style scoped>
.hero-fullscreen {
  position: relative;
  width: 100%;
  height: calc(100svh - 112px);
  min-height: 360px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}
.hero-bg {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
  z-index: 0;
}
.hero-overlay {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    to bottom,
    rgba(0, 0, 0, 0.3) 0%,
    rgba(0, 0, 0, 0.5) 50%,
    rgba(0, 0, 0, 0.7) 100%
  );
  z-index: 1;
}
.hero-content {
  position: relative;
  z-index: 2;
  text-align: center;
  color: white;
  padding: 2rem;
  width: 100%;
  min-width: 0;
}
.hero-title {
  font-size: 7rem;
  font-weight: 800;
  letter-spacing: 0;
  margin: 0;
  line-height: 1.1;
  text-shadow: 0 2px 30px rgba(0, 0, 0, 0.4);
}
.hero-rd {
  color: #ef4444;
}
.hero-studio {
  color: #b91c1c;
}
.hero-scroll-hint {
  position: absolute;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2;
  animation: bounce 2s ease infinite;
  font-size: 1.8rem;
  color: rgba(255, 255, 255, 0.6);
}
@keyframes bounce {
  0%, 100% { transform: translateX(-50%) translateY(0); }
  50% { transform: translateX(-50%) translateY(8px); }
}
@media (max-width: 768px) {
  .hero-title { font-size: 48px; }
  .hero-content { padding: 24px 16px; }
}
@media (max-width: 480px) { .hero-title { font-size: 36px; } }
@media (max-width: 360px) { .hero-title { font-size: 32px; } }
</style>
