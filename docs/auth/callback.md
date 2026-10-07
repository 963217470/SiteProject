---
title: 登录中...
layout: page
---

<script setup>
import { ref, onMounted } from 'vue'

const status = ref('正在处理...')

function returnAfterLogin() {
  const stored = localStorage.getItem('redirectAfterLogin') || '/'
  localStorage.removeItem('redirectAfterLogin')
  const target = new URL(stored, window.location.origin)
  const redirect = target.origin === window.location.origin
    ? target.pathname + target.search + target.hash : '/'
  setTimeout(() => { window.location.href = redirect }, 800)
}

onMounted(async () => {
  try {
    if (!window.__supabase) {
      status.value = '系统未加载'
      setTimeout(() => { window.location.href = '/login' }, 2000)
      return
    }

    const { data, error } = await window.__api.auth.getSession()
    if (error) throw error
    if (data.session) {
      status.value = '登录成功！正在跳转...'
      returnAfterLogin()
    } else {
      status.value = '登录失败，请重试'
      setTimeout(() => { window.location.href = '/login' }, 2000)
    }
  } catch (e) {
    status.value = '登录失败：' + e.message
    setTimeout(() => { window.location.href = '/login' }, 2000)
  }
})
</script>

<div class="callback-page">
  <div class="loading-spinner"></div>
  <p>{{ status }}</p>
</div>

<style scoped>
.callback-page { display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 80vh; gap: 1.5rem; }
.loading-spinner { width: 48px; height: 48px; border: 4px solid var(--vp-c-divider); border-top-color: var(--vp-c-brand-1); border-radius: 50%; animation: spin 1s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
