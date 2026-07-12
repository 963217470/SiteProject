---
title: 登录中...
layout: page
---

<script setup>
import { ref, onMounted } from 'vue'
import { useAuth } from '../.vitepress/theme/composables/useAuth'
import { toUserMessage } from '../.vitepress/theme/lib/errors'
import { takeLoginRedirect } from '../.vitepress/theme/lib/authRedirect'

const status = ref('正在处理...')
const auth = useAuth()

onMounted(async () => {
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.has('error')) {
      takeLoginRedirect()
      status.value = 'GitHub 授权未完成，请重新登录'
      setTimeout(() => { window.location.href = '/login' }, 2000)
      return
    }

    await auth.initializeAuth()
    if (auth.user.value) {
      status.value = '登录成功！正在跳转...'
      var redirectPath = takeLoginRedirect()
      setTimeout(() => { window.location.href = redirectPath }, 800)
    } else {
      takeLoginRedirect()
      status.value = '登录失败，请重试'
      setTimeout(() => { window.location.href = '/login' }, 2000)
    }
  } catch (e) {
    takeLoginRedirect()
    status.value = toUserMessage(e, 'auth')
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
