<template>
  <div ref="root" class="user-nav" @keydown.esc.stop="close(true)">
    <span v-if="loading" class="user-nav-loading" role="status" aria-label="正在加载账户"></span>
    <template v-else-if="user">
      <TaskDeadlineReminder :key="user.id" :user-id="user.id" @pending="taskPending=$event" />
      <button ref="trigger" class="user-menu" type="button" :aria-expanded="showMenu" aria-controls="rd-account-menu"
        aria-label="账户菜单" @click="showMenu = !showMenu" @keydown.down.prevent="openWithKeyboard">
        <img :src="avatar" alt="" class="user-avatar-sm" @error="avatar = '/images/default-avatar.svg'">
        <span v-if="taskPending" class="account-task-dot" aria-label="有未完成的派发任务" title="有未完成的派发任务"></span>
        <span class="user-name">{{ displayName }}</span>
        <span v-if="unread" class="account-unread-dot" :title="unread+' 条未读消息'" :aria-label="unread+' 条未读消息'"></span>
        <ChevronDown :size="16" aria-hidden="true" :class="{ expanded: showMenu }" />
      </button>
      <Transition name="account">
        <nav v-if="showMenu" id="rd-account-menu" class="user-dropdown" aria-label="个人账户" @keydown="navigateItems">
          <div class="dropdown-heading"><span>{{ displayName }}</span><span v-if="isAdmin" class="admin-badge">管理员</span></div>
          <a v-for="item in items" :key="item.href" :href="item.href" class="dropdown-item"><component :is="item.icon" :size="17" aria-hidden="true" />{{ item.label }}</a>
          <button type="button" class="dropdown-item" @click="checkin"><CalendarCheck :size="17" />每日签到</button>
          <a href="/messages/" class="dropdown-item"><Bell :size="17" />消息<span v-if="unread" class="community-badge">{{unread>99?'99+':unread}}</span></a>
          <template v-if="isAdmin"><div class="dropdown-divider"></div><a href="/admin" class="dropdown-item"><ShieldCheck :size="17" aria-hidden="true" />管理后台</a></template>
          <div class="dropdown-divider"></div>
          <button class="dropdown-item logout" type="button" :disabled="signingOut" @click="logout"><LogOut :size="17" aria-hidden="true" />{{ signingOut ? '正在退出…' : '退出登录' }}</button>
          <p v-if="error" class="account-error" role="alert">{{ error }}</p>
        </nav>
      </Transition>
    </template>
    <a v-else href="/login" class="login-link"><LogIn :size="16" aria-hidden="true" />登录</a>
  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vitepress'
import { Bell, CalendarCheck, Bookmark, ChevronDown, FileText, Gamepad2, History, LogIn, LogOut, Settings, ShieldCheck, UserRound, ListChecks, KeyRound, Shield } from 'lucide-vue-next'

import { communityRequest } from '../lib/community-api.mjs'
import TaskDeadlineReminder from './TaskDeadlineReminder.vue'
const taskPending=ref(false)
const unread=ref(0)
function checkin(){close();window.dispatchEvent(new CustomEvent('rd:checkin'))}
async function refreshUnread(){if(!user.value || document.hidden)return;const id=user.value.id;try{const result=await communityRequest('/messages/unread');if(user.value?.id===id)unread.value=result.unread}catch{}}
let accessRequest=0
async function refreshInternalAccess(){const run=++accessRequest;document.documentElement.dataset.rdInternalAccess='denied';try{const response=await fetch('/api/internal/access',{credentials:'same-origin'});const result=response.ok ? await response.json() : null;if(run===accessRequest)document.documentElement.dataset.rdInternalAccess=result?.allowed ? 'allowed' : 'denied'}catch{}}
const route = useRoute()
const root = ref(null)
const trigger = ref(null)
const loading = ref(true)
const user = ref(null)
const profile = ref(null)
const avatar = ref('/images/default-avatar.svg')
const showMenu = ref(false)
const signingOut = ref(false)
const error = ref('')
const isAdmin = computed(() => profile.value?.role === 'admin' || user.value?.app_metadata?.role === 'admin')
const displayName = computed(() => profile.value?.username || user.value?.user_metadata?.user_name || user.value?.user_metadata?.full_name || '用户')
const items = [
  { label: '个人主页', href: '/user/profile', icon: UserRound },
  { label: '我的发布', href: '/user/profile?tab=articles', icon: FileText },
  { label: '我的游戏/工具', href: '/user/profile?tab=catalog', icon: Gamepad2 },
  { label: '我的收藏', href: '/user/profile?tab=favorites', icon: Bookmark },
  { label: '浏览记录', href: '/user/profile?tab=recent', icon: History },
  { label: '我的任务', href: '/tasks', icon: ListChecks },
  { label: '个人设置', href: '/user/profile?tab=settings', icon: Settings },
  { label: 'AI / MCP 接入', href: '/user/profile?tab=mcp', icon: KeyRound },
  { label: '账号安全', href: '/user/profile?tab=security', icon: Shield }
]
let client
let unreadTimer
let subscription
let requestId = 0
function close(returnFocus = false) {
  showMenu.value = false
  if (returnFocus) trigger.value?.focus()
}
function outside(event) { if (!root.value?.contains(event.target)) close() }
function focusOutside(event) { if (!root.value?.contains(event.target)) close() }
async function openWithKeyboard() {
  showMenu.value = true
  await nextTick()
  root.value?.querySelector('.dropdown-item')?.focus()
}
function navigateItems(event) {
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
  const links = [...root.value.querySelectorAll('.dropdown-item:not(:disabled)')]
  const index = links.indexOf(document.activeElement)
  const target = event.key === 'Home' ? 0 : event.key === 'End' ? links.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : -1) + links.length) % links.length
  event.preventDefault()
  links[target]?.focus()
}
async function applySession(_event, session) {
  const id = ++requestId
  const previousUserId = user.value?.id
  user.value = session?.user || null
  if (previousUserId !== user.value?.id) taskPending.value=false
  refreshInternalAccess()
  unread.value=0
  if(user.value)refreshUnread()
  profile.value = null
  avatar.value = user.value?.user_metadata?.avatar_url || '/images/default-avatar.svg'
  if (!user.value) { loading.value = false; close(); return }
  try {
    const result = await client.from('profiles').select('username,avatar_url,role').eq('id', user.value.id).maybeSingle()
    if (id !== requestId) return
    profile.value = result.data
    avatar.value = result.data?.avatar_url || avatar.value
  } catch { /* Session metadata still provides a usable account menu. */ }
  finally { if (id === requestId) loading.value = false }
}
async function refreshProfile(){try{const result=await client?.auth.getSession();if(result?.data)await applySession('PROFILE_UPDATED',result.data.session)}catch{}}
async function logout() {
  if (signingOut.value) return
  signingOut.value = true
  error.value = ''
  try {
    const result = await client.auth.signOut()
    if (result.error) { error.value = result.error.message; return }
    window.location.assign('/')
  } catch { error.value = '退出失败，请稍后重试' }
  finally { signingOut.value = false }
}
watch(() => route.path, () => {close();refreshInternalAccess()})
onMounted(() => {
  client = window.__api
  if (!client) { loading.value = false; return }
  subscription = client.auth.onAuthStateChange(applySession).data.subscription
  document.addEventListener('pointerdown', outside)
  document.addEventListener('focusin', focusOutside)
  unreadTimer=setInterval(()=>{refreshUnread();refreshInternalAccess()},60000)
  window.addEventListener('rd:community-updated',refreshUnread)
  window.addEventListener('rd:community-updated',refreshInternalAccess)
  window.addEventListener('rd:profile-updated',refreshProfile)
  document.addEventListener('visibilitychange',refreshUnread)
})
onUnmounted(() => {
  ++requestId
  subscription?.unsubscribe()
  clearInterval(unreadTimer)
  window.removeEventListener('rd:community-updated',refreshUnread)
  window.removeEventListener('rd:community-updated',refreshInternalAccess)
  window.removeEventListener('rd:profile-updated',refreshProfile)
  ++accessRequest
  document.removeEventListener('visibilitychange',refreshUnread)
  document.removeEventListener('pointerdown', outside)
  document.removeEventListener('focusin', focusOutside)
})
</script>

<style scoped>
.user-nav { position: relative; display: flex; align-items: center; margin-left: 12px; min-height: 40px; }
.user-nav-loading { width: 32px; height: 32px; border-radius: 50%; background: var(--vp-c-bg-soft); }
.user-menu { display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 4px 8px; border-radius: 6px; color: var(--vp-c-text-1); transition: background 160ms; }
.user-menu:hover { background: var(--vp-c-bg-soft); }
.user-menu { position: relative; }
.account-task-dot { position: absolute; top: 3px; left: 30px; width: 10px; height: 10px; border-radius: 50%; background: #d6322f; border: 2px solid var(--vp-c-bg); pointer-events: none; }
.user-avatar-sm { width: 28px; height: 28px; border-radius: 50%; object-fit: cover; flex: none; }
.user-name { max-width: 130px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
.expanded { transform: rotate(180deg); }
.user-dropdown { position: absolute; top: 100%; right: 0; margin-top: 8px; width: min(248px, calc(100vw - 32px)); max-height: calc(100dvh - 88px); overflow-y: auto; background: var(--vp-c-bg); border: 1px solid var(--vp-c-divider); border-radius: 8px; box-shadow: 0 8px 28px rgba(0,0,0,.12); padding: 6px; z-index: 100; transform-origin: top right; }
.dropdown-heading { display: flex; align-items: center; gap: 8px; padding: 10px; border-bottom: 1px solid var(--vp-c-divider); margin-bottom: 4px; font-size: 13px; }
.dropdown-heading > span:first-child { overflow-wrap: anywhere; min-width: 0; }
.admin-badge { color: #d97706; font-size: 11px; flex: none; }
.dropdown-item { display: flex; align-items: center; gap: 10px; width: 100%; min-height: 42px; padding: 8px 10px; border-radius: 4px; font-size: 14px; color: var(--vp-c-text-1); text-decoration: none; text-align: left; transition: background 160ms; }
.dropdown-item:hover, .dropdown-item:focus-visible { background: var(--vp-c-bg-soft); }
.dropdown-item.logout { color: #dc2626; }
.dropdown-item:disabled { cursor: wait; opacity: .6; }
.dropdown-divider { height: 1px; background: var(--vp-c-divider); margin: 4px; }
.account-error { padding: 8px 10px; font-size: 13px; color: #dc2626; overflow-wrap: anywhere; }
.login-link { display: flex; align-items: center; gap: 8px; min-height: 40px; padding: 8px 16px; font-size: 14px; font-weight: 600; color: #fff; background: var(--vp-c-brand-1); border: 1px solid var(--vp-c-brand-1); border-radius: 8px; }
.login-link:hover { background: var(--vp-c-brand-2); color: #fff; }
.account-enter-active, .account-leave-active { transition: opacity 140ms, transform 140ms; }
.account-enter-from, .account-leave-to { opacity: 0; transform: translateY(-4px); }
@media (max-width: 640px) { .user-name { display: none; } .user-nav { margin-left: 4px; } .user-menu { gap: 4px; padding: 4px; } }
@media (prefers-reduced-motion: reduce) { *, .account-enter-active, .account-leave-active { transition: none; } }
</style>
