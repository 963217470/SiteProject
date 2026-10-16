<template>
  <nav v-if="active" class="admin-workspace-nav" aria-label="管理后台导航">
    <div class="admin-nav-inner">
      <div class="admin-nav-heading"><span><ShieldCheck :size="17" />管理工作台</span><a href="/" target="_self">返回网站<ArrowUpRight :size="15" /></a></div>
      <div class="admin-nav-links"><a v-for="item in adminNavigation" :key="item.id" :href="item.href" target="_self" :class="{'is-current':active===item.id}" :aria-current="active===item.id?'page':undefined"><component :is="icons[item.id]" :size="17" /><span>{{item.label}}</span></a></div>
      <label class="admin-nav-mobile">后台导航<select aria-label="切换管理页面" :value="active" @change="navigate"><option v-for="item in adminNavigation" :key="item.id" :value="item.id">{{item.label}}</option></select></label>
    </div>
  </nav>
</template>
<script setup>
import {onMounted,onUnmounted,ref,watch} from 'vue'
import {useRoute} from 'vitepress'
import {ArrowUpRight,FileText,FolderTree,Gamepad2,LayoutDashboard,ListChecks,MessageSquare,ShieldCheck,UserRound,UsersRound,ClipboardCheck} from 'lucide-vue-next'
import {adminNavigation,adminSection} from '../lib/admin-navigation.mjs'
const route=useRoute()
const active=ref(adminSection(route.path))
const icons={overview:LayoutDashboard,articles:FileText,comments:MessageSquare,catalog:Gamepad2,profiles:UserRound,knowledge:FolderTree,tasks:ListChecks,proofs:ClipboardCheck,people:UsersRound}
function sync(){active.value=adminSection(location.href)}
function navigate(event){const item=adminNavigation.find(n=>n.id===event.target.value);if(item)window.location.assign(item.href)}
onMounted(()=>{sync();window.addEventListener('rd:admin-navigation',sync);window.addEventListener('popstate',sync)})
watch(()=>route.path,sync,{flush:'post'})
onUnmounted(()=>{window.removeEventListener('rd:admin-navigation',sync);window.removeEventListener('popstate',sync)})
</script>
<style scoped>
.admin-workspace-nav{border-bottom:1px solid var(--vp-c-divider);background:var(--vp-c-bg);color:var(--vp-c-text-1)}.admin-nav-inner{max-width:1288px;margin:auto;padding:16px 24px 0}.admin-nav-heading{display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:12px;font-size:13px;color:var(--vp-c-text-2)}.admin-nav-heading span,.admin-nav-heading a{display:inline-flex;align-items:center;gap:7px}.admin-nav-heading span{font-weight:600}.admin-nav-heading a:hover{color:var(--vp-c-brand-1)}.admin-nav-links{display:flex;flex-wrap:wrap;gap:4px}.admin-nav-links a{position:relative;min-height:46px;display:inline-flex;align-items:center;justify-content:center;gap:7px;padding:10px 12px;font-size:14px;font-weight:600;color:var(--vp-c-text-2);text-decoration:none;border-radius:6px 6px 0 0;transition:background .15s,color .15s;white-space:nowrap}.admin-nav-links a:hover{background:var(--vp-c-bg-soft);color:var(--vp-c-brand-1)}.admin-nav-links a.is-current{color:var(--vp-c-brand-1);background:var(--vp-c-brand-soft)}.admin-nav-links a.is-current::after{content:'';height:3px;background:var(--vp-c-brand-1);position:absolute;bottom:0;left:12px;right:12px;border-radius:2px 2px 0 0}.admin-nav-links a:focus-visible,.admin-nav-mobile select:focus-visible{outline:2px solid var(--vp-c-brand-1);outline-offset:3px}.admin-nav-mobile{display:none}:global(body:has(.admin-workspace-nav) .studio-backdrop){display:none}@media(max-width:760px){.admin-nav-inner{padding:16px}.admin-nav-links{display:none}.admin-nav-mobile{display:flex;align-items:center;gap:16px;font-size:14px;font-weight:600}.admin-nav-mobile select{min-width:0;flex:1;min-height:44px;border:1px solid var(--vp-c-divider);border-radius:6px;background:var(--vp-c-bg);color:var(--vp-c-brand-1);font:inherit;padding:8px 12px}}@media(prefers-reduced-motion:reduce){.admin-nav-links a{transition:none}}
</style>
