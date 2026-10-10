<template>
  <dialog ref="dialog" class="checkin-dialog" aria-labelledby="checkin-title" @close="returnFocus">
    <button class="task-icon-button checkin-close" title="关闭" aria-label="关闭签到窗口" @click="dialog.close()"><X :size="22" /></button>
    <h2 id="checkin-title">每日签到</h2><p>已连续签到</p><strong class="checkin-number">{{ streak }}</strong><p>天</p>
    <p v-if="busy" role="status">签到中...</p><p v-else-if="error" role="alert">{{ error }}</p><p v-else>{{ result?.already ? '今天已经签到' : '+' + (result?.reward || 0) + ' EXP 已到账' }}</p>
    <button v-if="error" class="rd-button rd-button-primary" @click="sign">重试</button><button v-else class="rd-button rd-button-primary" :disabled="busy" @click="dialog.close()">完成</button>
  </dialog>
</template>
<script setup>
import { ref,onMounted,onUnmounted } from 'vue'
import { X } from 'lucide-vue-next'
import { communityRequest } from '../lib/community-api.mjs'
const dialog=ref(null),streak=ref(0),result=ref(null),busy=ref(false),error=ref('')
let previousFocus,disposed=false
async function sign(){if(busy.value)return;busy.value=true;error.value='';try{const data=await communityRequest('/community/checkin',{method:'POST',body:{}});if(disposed)return;result.value=data;streak.value=data.streak;window.dispatchEvent(new CustomEvent('rd:community-updated'))}catch(e){if(!disposed)error.value=e.message}finally{busy.value=false}}
function open(){if(dialog.value.open)return;previousFocus=document.activeElement;result.value=null;streak.value=0;dialog.value.showModal();sign()}
function returnFocus(){previousFocus?.focus?.()}
onMounted(()=>window.addEventListener('rd:checkin',open))
onUnmounted(()=>{disposed=true;window.removeEventListener('rd:checkin',open)})
</script>
