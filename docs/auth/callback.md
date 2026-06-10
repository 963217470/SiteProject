---
title: 登录中...
layout: page
---

<script setup>
import { ref, onMounted } from 'vue'

const status = ref('正在处理...')

onMounted(async () => {
  try {
    const hash = window.location.hash
    if (hash && hash.includes('access_token')) {
      const params = new URLSearchParams(hash.substring(1))
      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      const expiresIn = parseInt(params.get('expires_in') || '3600', 10)
      const tokenType = params.get('token_type') || 'bearer'

      if (accessToken) {
        const sessionData = {
          access_token: accessToken,
          refresh_token: refreshToken || '',
          expires_in: expiresIn,
          expires_at: Math.floor(Date.now() / 1000 + expiresIn),
          token_type: tokenType
        }
        localStorage.setItem('sb-auth-token', JSON.stringify(sessionData))
        window.location.hash = ''
        status.value = '登录成功！正在跳转...'
        setTimeout(() => { window.location.href = '/' }, 800)
        return
      }
    }

    if (!window.__supabase) {
      status.value = '系统未加载'
      setTimeout(() => { window.location.href = '/login' }, 2000)
      return
    }

    const { data } = await window.__supabase.auth.getSession()
    if (data.session) {
      status.value = '登录成功！正在跳转...'
      var redirectPath = localStorage.getItem('redirectAfterLogin') || '/'
      localStorage.removeItem('redirectAfterLogin')
      setTimeout(() => { window.location.href = redirectPath }, 800)
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
