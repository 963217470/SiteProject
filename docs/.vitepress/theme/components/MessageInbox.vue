<template>
  <section class="community-page"><div class="community-heading"><h1>消息</h1><span>{{ unread }} 条未读</span><button class="rd-button" :disabled="busy || !unread" @click="mark()"><CheckCheck :size="18" />全部已读</button></div>
    <p v-if="error" role="alert">{{ error }} <a v-if="unauthorized" href="/login/">登录</a><button v-else class="rd-button" @click="load">重试</button></p><p v-if="loading" role="status">加载消息...</p><p v-else-if="!items.length && !error">暂时没有消息</p>
    <article v-for="item in items" :key="item.id" class="notification-row" :class="{unread:!item.read_at}"><div><a :href="item.href" @click="mark(item.id)"><strong>{{ item.title }}</strong></a><p>{{ item.body }}</p><small>{{ new Date(item.created_at).toLocaleString('zh-CN') }}</small></div><button v-if="!item.read_at" class="task-icon-button" :disabled="busy" title="标记已读" aria-label="标记已读" @click="mark(item.id)"><Check :size="20" /></button></article>
    <nav class="rd-pagination" v-if="offset || more"><button class="rd-button" :disabled="busy || !offset" @click="page(-30)">上一页</button><span>{{offset/30+1}}</span><button class="rd-button" :disabled="busy || !more" @click="page(30)">下一页</button></nav>
  </section>
</template>
<script setup>
import { ref,onMounted,onUnmounted } from 'vue'
import { Check,CheckCheck } from 'lucide-vue-next'
import { communityRequest } from '../lib/community-api.mjs'
const items=ref([]),unread=ref(0),offset=ref(0),more=ref(false),busy=ref(false),loading=ref(true),error=ref(''),unauthorized=ref(false)
let disposed=false,revision=0,subscription
async function load(){const request=++revision;loading.value=true;error.value='';try{const data=await communityRequest('/messages?offset='+offset.value);if(disposed||request!==revision)return;items.value=data.items;unread.value=data.unread;more.value=data.has_more;unauthorized.value=false}catch(e){if(!disposed&&request===revision){error.value=e.message;unauthorized.value=e.status===401;items.value=[]}}finally{if(request===revision)loading.value=false}}
async function mark(id){if(busy.value)return;busy.value=true;try{await communityRequest('/messages/read',{method:'POST',body:id?{id}:{}});await load();window.dispatchEvent(new CustomEvent('rd:community-updated'))}catch(e){error.value=e.message}finally{busy.value=false}}
function page(delta){offset.value+=delta;load()}
onMounted(()=>{load();subscription=window.__api?.auth.onAuthStateChange(event=>{if(event!=='INITIAL_SESSION'){items.value=[];unread.value=0;offset.value=0;load()}}).data.subscription})
onUnmounted(()=>{disposed=true;++revision;subscription?.unsubscribe()})
</script>
