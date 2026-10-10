<template><nav class="community-links" aria-label="探索社团"><a v-for="item in items" :key="item.href" :href="item.href"><component :is="item.icon" :size="22" aria-hidden="true" /><div><strong>{{ item.title }}</strong><span>{{ item.text }}</span></div><ArrowUpRight :size="17" class="community-arrow" aria-hidden="true" /></a></nav></template>
<script setup>
import { ArrowUpRight, ListChecks, LibraryBig, UsersRound } from 'lucide-vue-next'
const items = [
  { href: '/tasks', title: '今天也推进一点点', text: '日常签到、任务与创作挑战', icon: ListChecks },
  { href: '/kb', title: '知识库', text: '沿着知识分支持续学习', icon: LibraryBig },
  { href: '/about', title: '认识 RD STUDIO', text: '一起创造、学习、分享', icon: UsersRound }
]
</script>
<style scoped>
.community-links { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 32px; width: min(1180px,calc(100% - 48px)); margin: 0 auto; padding: 32px 0; border-bottom: 1px solid var(--vp-c-divider); }
.community-links a { display: flex; align-items: center; gap: 14px; min-width: 0; color: var(--vp-c-text-1); }
.community-links a > svg:first-child { flex: none; color: var(--vp-c-brand-1); }
.community-links strong { display: block; font-size: 15px; font-weight: 600; }
.community-links span { display: block; font-size: 12px; color: var(--vp-c-text-2); margin-top: 5px; }
.community-links .community-arrow { flex: none; margin-left: auto; }
.community-links a:hover strong { color: var(--vp-c-brand-1); }
@media(max-width:640px) { .community-links { grid-template-columns: minmax(0,1fr); gap: 24px; width: calc(100% - 32px); padding: 24px 0; } }
</style>
