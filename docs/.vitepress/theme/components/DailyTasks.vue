<template>
  <section class="daily-tasks" aria-label="日常任务">
    <div class="community-heading"><h2>日常任务</h2><span v-if="daily">{{ daily.day }} · 每日 00:00 刷新</span><button class="task-icon-button" title="刷新日常任务" aria-label="刷新日常任务" :disabled="loading" @click="load"><RotateCw :size="18" /></button></div>
    <p v-if="error" role="alert">{{ error }} <button class="rd-button" @click="load">重试</button></p>
    <p v-else-if="!daily" role="status">加载日常任务...</p>
    <template v-else>
      <div v-for="task in daily.tasks" :key="task.kind" class="daily-task-row"><span>{{ task.title }}<small v-if="task.kind==='read'">{{ daily.reading_seconds }} / 150 秒</small></span><strong>+{{ task.reward }} EXP</strong><Check v-if="task.done" :size="20" class="daily-done" aria-label="已完成" /><button v-else-if="task.kind==='checkin'" class="rd-button rd-button-primary" @click="checkin"><CalendarCheck :size="17" />签到</button><span v-else class="task-meta">未完成</span></div>
      <div class="advanced-task"><h3>进阶任务 <span>+100 EXP</span></h3><p>{{ daily.advanced_unlocked ? '已解锁，任务内容待公布' : '达到 50 EXP 解锁' }}</p></div>
    </template>
  </section>
</template>
<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { CalendarCheck, Check, RotateCw } from 'lucide-vue-next'
import { communityRequest } from '../lib/community-api.mjs'
const daily=ref(null),error=ref(''),loading=ref(false)
let timer,disposed=false,revision=0
async function load(){const request=++revision;loading.value=true;error.value='';try{const data=await communityRequest('/community/daily');if(disposed||request!==revision)return;daily.value=data;clearTimeout(timer);timer=setTimeout(load,Math.min(2147483647,Math.max(1000,data.reset_at-Date.now()+500)))}catch(e){if(!disposed&&request===revision)error.value=e.message}finally{if(!disposed&&request===revision)loading.value=false}}
function checkin(){window.dispatchEvent(new CustomEvent('rd:checkin'))}
function foreground(){if(!document.hidden)load()}
onMounted(()=>{load();window.addEventListener('rd:community-updated',load);document.addEventListener('visibilitychange',foreground)})
onUnmounted(()=>{disposed=true;++revision;clearTimeout(timer);window.removeEventListener('rd:community-updated',load);document.removeEventListener('visibilitychange',foreground)})
</script>
