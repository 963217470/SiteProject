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
const email = ref('')
const password = ref('')
const passwordLoading = ref(false)

onMounted(() => {
  if (!window.__supabase) {
    errorMsg.value = '系统未加载，请刷新页面'
    loading.value = false
    return
  }

  window.__supabase.auth.getSession().then(r => {
    if (r.data.session) {
      isLoggedIn.value = true
      username.value = r.data.session.user.email || '用户'
    }
  }).catch(() => {}).finally(() => {
    loading.value = false
  })
})

function doLogin() {
  var origin = window.location.origin.includes('localhost') ? 'https://963217470.github.io' : window.location.origin
  window.location.href = 'https://jenrgzwwowgfqbwcozbi.supabase.co/auth/v1/authorize?provider=github&redirect_to=' + encodeURIComponent(origin + '/SiteProject/auth/callback')
}

async function doPasswordLogin() {
  if (!email.value || !password.value) {
    errorMsg.value = '请输入邮箱和密码'
    return
  }

  passwordLoading.value = true
  errorMsg.value = ''

  try {
    const { data, error } = await window.__supabase.auth.signInWithPassword({
      email: email.value,
      password: password.value
    })

    if (error) {
      errorMsg.value = '登录失败：' + error.message
      return
    }

    if (data?.session) {
      isLoggedIn.value = true
      username.value = data.session.user.email || '用户'
      window.location.href = '/SiteProject/'
    }
  } catch (e) {
    errorMsg.value = '登录失败：' + (e?.message || '未知错误')
  } finally {
    passwordLoading.value = false
  }
}

async function logout() {
  if (window.__supabase) await window.__supabase.auth.signOut()
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
      <a v-if="isLoggedIn" href="/SiteProject/" class="github-login-btn" style="text-decoration:none;text-align:center;">进入首页</a>
      <button v-if="isLoggedIn" class="logout-btn" @click="logout">退出登录</button>
      <button v-if="!isLoggedIn && !loading" class="github-login-btn" type="button" @click="doLogin">🔑 使用 GitHub 登录</button>
      <form v-if="!isLoggedIn && !loading" class="password-login" @submit.prevent="doPasswordLogin">
        <input v-model="email" type="email" placeholder="测试账号邮箱" autocomplete="username">
        <input v-model="password" type="password" placeholder="测试账号密码" autocomplete="current-password">
        <button class="password-login-btn" type="submit" :disabled="passwordLoading">
          {{ passwordLoading ? '登录中...' : '测试账号登录' }}
        </button>
      </form>
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
.password-login { display: grid; gap: 0.75rem; margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--vp-c-divider); }
.password-login input { width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--vp-c-divider); border-radius: 8px; background: var(--vp-c-bg); color: var(--vp-c-text-1); font: inherit; }
.password-login input:focus { outline: none; border-color: var(--vp-c-brand-1); }
.password-login-btn { width: 100%; padding: 0.8rem 1rem; background: var(--vp-c-brand-1); color: white; border: none; border-radius: 8px; cursor: pointer; font-weight: 600; }
.password-login-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.login-hint { margin-top: 1.5rem; font-size: 0.875rem; color: var(--vp-c-text-2); }
.login-error { margin-top: 1rem; padding: 0.75rem; background: #fee2e2; border: 1px solid #fecaca; border-radius: 8px; color: #dc2626; text-align: center; }
.logout-btn { margin-top: 1rem; padding: 0.5rem 1.5rem; font-size: 0.875rem; color: var(--vp-c-text-2); background: transparent; border: 1px solid var(--vp-c-divider); border-radius: 8px; cursor: pointer; }
.logout-btn:hover { border-color: #dc2626; color: #dc2626; }
</style>
