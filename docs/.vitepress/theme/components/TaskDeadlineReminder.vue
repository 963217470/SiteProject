<template>
  <Teleport to="body">
    <a v-if="reminder?.count && reminder.nearest" href="/tasks/?scope=mine" class="task-deadline-reminder" :class="{overdue:remaining<=0}">
      <Clock3 :size="18" aria-hidden="true" /><span><strong>{{ remaining<=0 ? '任务已逾期' : '距最近任务完成期限' }} <span role="timer" aria-live="off">{{ countdown }}</span></strong><small>{{ reminder.nearest.title }} · {{ reminder.count }} 项待完成{{ reminder.nearest.state==='submitted' ? ' · 证明待审核' : '' }}</small></span><ArrowUpRight :size="16" aria-hidden="true" />
    </a>
  </Teleport>
</template>
<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ArrowUpRight, Clock3 } from 'lucide-vue-next'
import { taskRequest } from '../lib/task-api.mjs'
import { deadlineCountdown } from '../lib/task-deadline.mjs'
defineProps({ userId: { type: String, required: true } })
const emit=defineEmits(['pending'])
const reminder=ref(null), clock=ref(Date.now()), offset=ref(0)
const remaining=computed(()=>(reminder.value?.nearest?.deadline||0)-clock.value-offset.value)
const countdown=computed(()=>deadlineCountdown(reminder.value?.nearest?.deadline||0,clock.value+offset.value))
let disposed=false, polling, ticking, inFlight=false, retry=false
async function refresh(){
  if(disposed || document.hidden)return
  if(inFlight){retry=true;return}
  inFlight=true
  try{const result=await taskRequest('/reminder');if(disposed)return;reminder.value=result;offset.value=result.server_now-Date.now();clock.value=Date.now();emit('pending',Boolean(result.count))}
  catch(error){if(!disposed && error.status===401){reminder.value=null;emit('pending',false)}}
  finally{inFlight=false;if(retry && !disposed){retry=false;refresh()}}
}
onMounted(()=>{refresh();polling=setInterval(refresh,30000);ticking=setInterval(()=>{clock.value=Date.now()},1000);window.addEventListener('rd:task-updated',refresh);window.addEventListener('rd:community-updated',refresh);window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh)})
onUnmounted(()=>{disposed=true;clearInterval(polling);clearInterval(ticking);window.removeEventListener('rd:task-updated',refresh);window.removeEventListener('rd:community-updated',refresh);window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh)})
</script>
<style scoped>
.task-deadline-reminder{position:fixed;bottom:16px;left:16px;z-index:90;display:flex;align-items:center;gap:10px;max-width:min(520px,calc(100vw - 112px));padding:12px 16px;border:1px solid #e9b6b2;border-radius:8px;background:var(--vp-c-bg);color:var(--vp-c-text-1);box-shadow:0 4px 16px #00000012;text-decoration:none}
.task-deadline-reminder>svg{flex:none;color:#b42e28}.task-deadline-reminder>span{min-width:0}.task-deadline-reminder strong{display:block;font-size:13px;line-height:1.6}.task-deadline-reminder [role=timer]{color:#b42e28;font-variant-numeric:tabular-nums;white-space:nowrap}.task-deadline-reminder small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;font-size:12px;color:var(--vp-c-text-2)}
.task-deadline-reminder.overdue{border-color:#b42e28}@media(max-width:480px){.task-deadline-reminder{left:8px;bottom:8px;padding:10px;gap:6px}.task-deadline-reminder strong{font-size:12px}}
</style>
