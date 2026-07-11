---
title: 登录
layout: page
---

<script setup>
import { ref, onMounted } from 'vue'

const loading = ref(true)
const isLoggedIn = ref(false)
const username = ref('')
const errorMsg = ref('')

onMounted(() => {
  if (!window.getSupabaseClient?.()) {
    errorMsg.value = '系统未加载，请刷新页面'
    loading.value = false
    return
  }

  window.getSupabaseClient?.().auth.getSession().then(r => {
    if (r.data.session) {
      isLoggedIn.value = true
      username.value = r.data.session.user.email || '用户'
    }
  }).catch(() => {}).finally(() => {
    loading.value = false
  })
})

function doLogin() {
  var origin = window.location.origin
  window.location.href = 'https://jenrgzwwowgfqbwcozbi.supabase.co/auth/v1/authorize?provider=github&redirect_to=' + encodeURIComponent(origin + '/auth/callback')
}

async function logout() {
  if (window.getSupabaseClient?.()) await window.getSupabaseClient?.().auth.signOut()
  isLoggedIn.value = false
  username.value = ''
}
</script>

<div class="login-page">
  <div class="login-card">
    <div class="login-header">
      <h1>🎮 RD STUDIO</h1>
      <p v-if="loading">加载中...</p>
      <p v-else-if="isLoggedIn">已登录为 {{ username }}</p>
      <p v-else>使用 GitHub 账号登录</p>
    </div>
    <div class="login-content">
      <a v-if="isLoggedIn" href="/" class="github-login-btn" style="text-decoration:none;text-align:center;">进入首页</a>
      <button v-if="isLoggedIn" class="logout-btn" @click="logout">退出登录</button>
      <button v-if="!isLoggedIn && !loading" class="github-login-btn" type="button" @click="doLogin">🔑 使用 GitHub 登录</button>
      <p v-if="!isLoggedIn && !loading" class="login-hint">还没有账号？<br>登录后自动创建账号</p>
    </div>
    <div v-if="errorMsg" class="login-error">{{ errorMsg }}</div>
  </div>
</div>

<style scoped>
.login-page { display: flex; justify-content: center; align-items: center; min-height: 80vh; }
.login-card { width: 100%; max-width: 400px; padding: 2rem; background: var(--vp-c-bg); border: 1px solid var(--vp-c-divider); border-radius: 12px; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1); }
.login-header { text-align: center; margin-bottom: 2rem; }
.login-header h1 { margin: 0 0 0.5rem 0; font-size: 1.75rem; }
.login-header p { margin: 0; color: var(--vp-c-text-2); }
.login-content { text-align: center; }
.github-login-btn { display: block; width: 100%; padding: 1rem 2rem; font-size: 1rem; font-weight: 600; color: white; background: #24292e; border: none; border-radius: 8px; cursor: pointer; transition: background 0.3s ease; text-decoration: none; text-align: center; }
.github-login-btn:hover { background: #2f363d; }
.login-hint { margin-top: 1.5rem; font-size: 0.875rem; color: var(--vp-c-text-2); }
.login-error { margin-top: 1rem; padding: 0.75rem; background: #fee2e2; border: 1px solid #fecaca; border-radius: 8px; color: #dc2626; text-align: center; }
.logout-btn { margin-top: 1rem; padding: 0.5rem 1.5rem; font-size: 0.875rem; color: var(--vp-c-text-2); background: transparent; border: 1px solid var(--vp-c-divider); border-radius: 8px; cursor: pointer; }
.logout-btn:hover { border-color: #dc2626; color: #dc2626; }
</style>
