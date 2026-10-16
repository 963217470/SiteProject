<template>
  <dialog ref="dialog" class="checkin-dialog" aria-labelledby="checkin-title" @close="returnFocus">
    <button class="task-icon-button checkin-close" title="关闭" aria-label="关闭签到窗口" @click="dialog.close()"><X :size="22" /></button>
    <h2 id="checkin-title">每日签到</h2><p>已连续签到</p><strong class="checkin-number">{{ streak }}</strong><p>天</p>
    <p v-if="busy" role="status">签到中...</p><p v-else-if="error" role="alert">{{ error }}</p><p v-else>{{ result?.already ? '今天已经签到' : '+' + (result?.reward || 0) + ' EXP 已到账' }}</p>
    <button v-if="error" class="rd-button rd-button-primary" @click="sign()">重试</button><button v-else class="rd-button rd-button-primary" :disabled="busy" @click="dialog.close()">完成</button>
  </dialog>
</template>
<script setup>
import { ref,onMounted,onUnmounted } from 'vue'
import { X } from 'lucide-vue-next'
import { communityRequest } from '../lib/community-api.mjs'
const dialog=ref(null),streak=ref(0),result=ref(null),busy=ref(false),error=ref('')
const props=defineProps({automatic:{type:Boolean,default:true}})
let previousFocus,disposed=false,account='',authRevision=0,autoBusy=false,nextCheck=0,subscription
function deferUntilReset(data){if(Number.isFinite(data.reset_at)&&Number.isFinite(data.server_time))nextCheck=performance.now()+Math.max(1000,Math.min(86400000,data.reset_at-data.server_time))}
async function sign(automatic=false){if(busy.value)return;busy.value=true;error.value='';const run=authRevision;try{const data=await communityRequest('/community/checkin',{method:'POST',body:{}});if(disposed||run!==authRevision)return;result.value=data;streak.value=data.streak;deferUntilReset(data);if(automatic&&!data.already&&!document.querySelector('dialog[open]')){previousFocus=document.activeElement;dialog.value.showModal()}window.dispatchEvent(new CustomEvent('rd:community-updated'));return data}catch(e){if(!disposed&&run===authRevision&&!automatic)error.value=e.message}finally{busy.value=false;if(!disposed&&run!==authRevision)check()}}
function open(){if(dialog.value.open)return;previousFocus=document.activeElement;result.value=null;streak.value=0;dialog.value.showModal();sign()}
function returnFocus(){previousFocus?.focus?.()}
async function check(){if(!props.automatic||disposed||!account||document.hidden||busy.value||autoBusy||performance.now()<nextCheck)return;autoBusy=true;const run=authRevision;try{const data=await communityRequest('/community/daily');if(disposed||run!==authRevision||performance.now()<nextCheck)return;if(data.checked_in)deferUntilReset(data);else if(!busy.value){const signed=await sign(true);if(!signed&&run===authRevision)nextCheck=performance.now()+60000}}catch{if(run===authRevision)nextCheck=performance.now()+60000}finally{autoBusy=false;if(!disposed&&run!==authRevision)check()}}
function sessionChanged(session){const id=session?.user?.id||'';if(id===account)return;++authRevision;account=id;nextCheck=0;result.value=null;streak.value=0;error.value='';dialog.value?.close();check()}
onMounted(()=>{window.addEventListener('rd:checkin',open);if(props.automatic){subscription=window.__api?.auth.onAuthStateChange((_event,session)=>sessionChanged(session)).data.subscription;const run=authRevision;window.__api?.auth.getSession().then(r=>{if(!disposed&&run===authRevision)sessionChanged(r.data?.session)}).catch(()=>{});window.addEventListener('focus',check);document.addEventListener('visibilitychange',check);document.addEventListener('pointerdown',check,{passive:true});document.addEventListener('keydown',check)}})
onUnmounted(()=>{disposed=true;++authRevision;subscription?.unsubscribe();window.removeEventListener('rd:checkin',open);window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check);document.removeEventListener('pointerdown',check);document.removeEventListener('keydown',check)})
</script>
