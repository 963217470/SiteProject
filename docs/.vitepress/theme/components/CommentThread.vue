<template>
  <section v-if="articleId && !unavailable" id="comments" class="community-comments">
    <div class="community-heading"><h2>评论</h2><button class="task-icon-button" title="刷新评论" aria-label="刷新评论" :disabled="busy" @click="load"><RotateCw :size="18" /></button></div>
    <p v-if="error" role="alert">{{ error }}</p><p v-if="message" role="status">{{ message }}</p><p v-if="loading" role="status">加载评论...</p>
    <form v-if="user" @submit.prevent="submit"><div v-if="parent" class="community-heading"><span>回复 {{ parent.username }}</span><button type="button" class="task-icon-button" title="取消回复" aria-label="取消回复" @click="parent=null"><X :size="18" /></button></div><label for="community-comment-content">{{ parent ? '回复内容' : '发表评论' }}</label><textarea ref="editor" id="community-comment-content" v-model="content" rows="3" maxlength="10000" required :disabled="busy"></textarea><button class="rd-button rd-button-primary" :disabled="busy || !content.trim()"><Send :size="17" />{{busy?'提交中...':'提交审核'}}</button></form>
    <p v-else><a href="/login/">登录后发表评论</a></p>
    <p v-if="!loading && !items.length">暂无评论</p>
    <article v-for="item in items" :key="item.id" class="community-comment" :class="{reply:item.parent_id}"><header><img :src="item.avatar_url || '/images/default-avatar.svg'" alt="" @error="$event.target.src='/images/default-avatar.svg'"><strong>{{item.username}}</strong><small>{{new Date(item.created_at).toLocaleString('zh-CN')}}</small><span v-if="item.status!=='approved'" class="comment-status">{{item.status==='pending'?'待审核':'未通过审核'}}</span></header><small v-if="item.parent_id">回复 {{item.parent_username}}</small><p>{{item.content}}</p><p v-if="item.review_note && item.status==='rejected'">审核说明：{{item.review_note}}</p><button v-if="user && item.status==='approved'" class="rd-button" :disabled="busy" @click="reply(item)"><Reply :size="16" />回复</button></article>
    <nav v-if="offset || more" class="rd-pagination"><button class="rd-button" :disabled="busy || !offset" @click="page(-50)">上一页</button><span>{{offset/50+1}}</span><button class="rd-button" :disabled="busy || !more" @click="page(50)">下一页</button></nav>
  </section>
</template>
<script setup>
import { ref,onMounted,onUnmounted,nextTick } from 'vue'
import { Reply,RotateCw,Send,X } from 'lucide-vue-next'
import { communityRequest } from '../lib/community-api.mjs'
const articleId=ref(''),items=ref([]),user=ref(null),parent=ref(null),content=ref(''),editor=ref(null),error=ref(''),message=ref(''),loading=ref(true),busy=ref(false),unavailable=ref(false),offset=ref(0),more=ref(false)
let revision=0,disposed=false,subscription
async function load(){const request=++revision;loading.value=true;error.value='';articleId.value=new URLSearchParams(location.search).get('id')||'';if(!articleId.value){loading.value=false;return}try{const data=await communityRequest('/comments?article_id='+encodeURIComponent(articleId.value)+'&offset='+offset.value);if(disposed||request!==revision)return;items.value=data.items;more.value=data.has_more;unavailable.value=false}catch(e){if(!disposed&&request===revision){error.value=e.message;unavailable.value=e.status===404;items.value=[]}}finally{if(request===revision)loading.value=false}}
async function submit(){if(busy.value)return;busy.value=true;error.value='';message.value='';try{await communityRequest('/comments',{method:'POST',body:{article_id:articleId.value,content:content.value,parent_id:parent.value?.id||null}});content.value='';parent.value=null;message.value='评论已提交，审核通过后公开展示';await load();window.dispatchEvent(new CustomEvent('rd:community-updated'))}catch(e){error.value=e.message}finally{busy.value=false}}
async function reply(item){parent.value=item;await nextTick();editor.value?.focus();editor.value?.scrollIntoView({block:'center',behavior:'smooth'})}
function page(delta){offset.value+=delta;load()}
onMounted(async()=>{load();const result=await window.__api?.auth.getSession();if(disposed)return;user.value=result?.data?.session?.user||null;subscription=window.__api?.auth.onAuthStateChange((_event,session)=>{user.value=session?.user||null;items.value=[];parent.value=null;content.value='';offset.value=0;load()}).data.subscription;window.addEventListener('popstate',load)})
onUnmounted(()=>{disposed=true;++revision;subscription?.unsubscribe();window.removeEventListener('popstate',load)})
</script>
