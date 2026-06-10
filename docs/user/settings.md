---
title: 个人设置
layout: page
---

<div class="settings-redirect">
  <h1>个人设置</h1>
  <p>个人设置已经合并到个人中心。</p>
  <a href="/user/profile?tab=settings">打开个人设置</a>
</div>

<script>
if (typeof window !== 'undefined') {
  window.location.replace('/user/profile?tab=settings')
}
</script>

<style scoped>
.settings-redirect {
  display: grid;
  gap: 0.75rem;
  place-items: center;
  min-height: 56vh;
  text-align: center;
}

.settings-redirect h1,
.settings-redirect p {
  margin: 0;
}

.settings-redirect p {
  color: var(--vp-c-text-2);
}

.settings-redirect a {
  display: inline-grid;
  place-items: center;
  min-height: 40px;
  padding: 0 1rem;
  border-radius: 8px;
  background: var(--vp-c-brand-1);
  color: #fff;
  text-decoration: none;
}
</style>
