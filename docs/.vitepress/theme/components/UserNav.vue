<template>
  <div class="user-nav">
    <template v-if="loading">
      <span class="user-nav-loading"></span>
    </template>
    <template v-else-if="isLoggedIn">
      <div class="user-menu" @click="showMenu = !showMenu">
        <img :src="avatar" alt="avatar" class="user-avatar-sm">
        <div class="user-info">
          <div class="user-name-and-badge">
            <span class="user-name">{{ displayName }}</span>
            <span v-if="isAdmin" class="admin-badge">👑 管理员</span>
          </div>
        </div>
      </div>
      <div v-if="showMenu" class="user-dropdown">
        <a href="/user/profile" class="dropdown-item" @click.prevent="go('/user/profile')">个人主页</a>
        <a href="/user/profile?tab=articles" class="dropdown-item" @click.prevent="go('/user/profile?tab=articles')">我的文章</a>
        <a href="/user/profile?tab=favorites" class="dropdown-item" @click.prevent="go('/user/profile?tab=favorites')">我的收藏</a>
        <template v-if="isAdmin">
          <div class="dropdown-divider"></div>
          <a href="/admin" class="dropdown-item admin-item" @click.prevent="go('/admin')">
            🔧 管理后台
          </a>
        </template>
        <div class="dropdown-divider"></div>
        <button class="dropdown-item logout" @click="logout">退出登录</button>
      </div>
    </template>
    <template v-else>
      <a href="/login" class="login-link" @click.prevent="go('/login')">登录</a>
    </template>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const loading = ref(true)
const isLoggedIn = ref(false)
const isAdmin = ref(false)
const displayName = ref('')
const avatar = ref('/images/default-avatar.svg')
const showMenu = ref(false)

let supabase = null

function go(url) { window.location.href = url }

function getMetaName(user) {
  var meta = user && user.user_metadata ? user.user_metadata : {}
  return meta.full_name || meta.user_name || meta.name || meta.preferred_username || user.email || '用户'
}

function getMetaAvatar(user) {
  var meta = user && user.user_metadata ? user.user_metadata : {}
  return meta.avatar_url || meta.picture || '/images/default-avatar.svg'
}

function handleClickOutside(e) {
  if (!e.target.closest('.user-nav')) showMenu.value = false
}

onMounted(() => {
  if (typeof window === 'undefined' || !window.__supabase) { loading.value = false; return }
  supabase = window.__supabase

  supabase.auth.getSession().then(function(r) {
    if (r.data && r.data.session) {
      isLoggedIn.value = true
      var user = r.data.session.user
      displayName.value = getMetaName(user)
      avatar.value = getMetaAvatar(user)
      
      if (!user.id) return null;

      return supabase
        .from('profiles')
        .select('username, avatar_url, role')
        .eq('id', user.id)
        .useServiceRole()
        .maybeSingle();
    }
  }).then(function(r) {
    if (!r || !r.data) return
    if (r.data.username) displayName.value = r.data.username
    if (r.data.avatar_url) avatar.value = r.data.avatar_url
    if (r.data.role === 'admin') isAdmin.value = true
  }).catch(function(e) {
    console.log('获取用户资料失败:', e)
  }).finally(function() {
    loading.value = false
  })

  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})

function logout() {
  if (supabase) {
    supabase.auth.signOut().then(function() {
      isLoggedIn.value = false
      displayName.value = ''
      showMenu.value = false
      window.location.href = '/'
    })
  }
}
</script>

<style scoped>
.user-nav { position: relative; display: flex; align-items: center; margin-left: 1rem; }
.user-nav-loading { width: 32px; height: 32px; border-radius: 50%; background: var(--vp-c-bg-soft); animation: pulse 1.5s ease-in-out infinite; }
@keyframes pulse { 0%, 100% { opacity: 0.4; } 50% { opacity: 0.8; } }
.user-menu { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; padding: 0.25rem 0.75rem; border-radius: 8px; transition: background 0.2s; }
.user-menu:hover { background: var(--vp-c-bg-soft); }
.user-avatar-sm { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; }
.user-info { display: flex; flex-direction: column; }
.user-name-and-badge { display: flex; align-items: center; gap: 0.5rem; }
.user-name { font-size: 0.875rem; color: var(--vp-c-text-1); }
.admin-badge { 
  font-size: 0.7rem; 
  background: linear-gradient(135deg, #f59e0b, #d97706); 
  color: white; 
  padding: 0.1rem 0.5rem; 
  border-radius: 9999px;
  font-weight: 600;
  box-shadow: 0 2px 4px rgba(245, 158, 11, 0.3);
}
.user-dropdown { position: absolute; top: 100%; right: 0; margin-top: 0.5rem; background: var(--vp-c-bg); border: 1px solid var(--vp-c-divider); border-radius: 8px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1); min-width: 170px; z-index: 100; padding: 0.5rem 0; }
.dropdown-item { display: block; width: 100%; padding: 0.5rem 1rem; font-size: 0.875rem; color: var(--vp-c-text-1); text-decoration: none; background: none; border: none; text-align: left; cursor: pointer; transition: background 0.2s; }
.dropdown-item:hover { background: var(--vp-c-bg-soft); }
.dropdown-item.admin-item { color: #d97706; font-weight: 600; }
.dropdown-item.admin-item:hover { background: #fffbeb; }
.dropdown-item.logout { color: #dc2626; }
.dropdown-divider { height: 1px; background: var(--vp-c-divider); margin: 0.25rem 0; }
.login-link { padding: 0.4rem 1rem; font-size: 0.875rem; color: var(--vp-c-brand-1); text-decoration: none; border: 1px solid var(--vp-c-brand-1); border-radius: 6px; transition: all 0.2s; }
.login-link:hover { background: var(--vp-c-brand-1); color: white; }

:global(.VPNav.nav-at-top) .login-link,
:global(.is-home .VPNav.nav-at-top) .login-link {
  color: white;
  border-color: rgba(255, 255, 255, 0.75);
  background: rgba(255, 255, 255, 0.08);
}

:global(.VPNav.nav-at-top) .login-link:hover,
:global(.is-home .VPNav.nav-at-top) .login-link:hover {
  color: white;
  border-color: white;
  background: rgba(255, 255, 255, 0.18);
}

:global(.VPNav.nav-at-top) .user-name,
:global(.is-home .VPNav.nav-at-top) .user-name {
  color: white;
}

:global(.VPNav.nav-at-top) .user-menu:hover,
:global(.is-home .VPNav.nav-at-top) .user-menu:hover {
  background: rgba(255, 255, 255, 0.12);
}

:global(.VPNav.nav-scrolled) .login-link,
:global(.is-home .VPNav.nav-scrolled) .login-link {
  color: var(--vp-c-text-1);
  border-color: var(--vp-c-divider);
  background: var(--vp-c-bg);
}

:global(.VPNav.nav-scrolled) .login-link:hover,
:global(.is-home .VPNav.nav-scrolled) .login-link:hover {
  color: white;
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-1);
}

:global(.VPNav.nav-scrolled) .user-name,
:global(.is-home .VPNav.nav-scrolled) .user-name {
  color: var(--vp-c-text-1);
}
</style>
