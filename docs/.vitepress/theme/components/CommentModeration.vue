<template>
  <section class="community-page"><div class="community-heading"><h1>评论审核</h1><a class="rd-button" href="/admin/">管理后台</a></div><div class="rd-segments"><button v-for="option in statuses" :key="option.id" :aria-pressed="status===option.id" @click="changeStatus(option.id)">{{option.title}}</button></div>
    <p v-if="error" role="alert">{{error}}</p><p v-if="loading" role="status">加载评论...</p><p v-else-if="!items.length && !error">暂无评论</p>
    <article v-for="item in items" :key="item.id" class="comment-review"><div class="community-heading"><strong>{{item.username}}</strong><a :href="'/article?id='+encodeURIComponent(item.article_id)">{{item.title}}</a></div><p>{{item.content}}</p><p v-if="item.review_note">{{item.review_note}}</p><template v-if="item.status!=='rejected'"><label :for="'review-'+item.id">审核说明</label><textarea :id="'review-'+item.id" v-model="notes[item.id]" maxlength="1000" rows="2"></textarea><div class="comment-review-actions"><button v-if="item.status==='pending'" class="rd-button rd-button-primary" :disabled="busy" @click="review(item,true)"><Check :size="17" />通过</button><button class="rd-button" :disabled="busy" @click="review(item,false)"><X :size="17" />{{item.status==='approved'?'下架':'拒绝'}}</button></div></template></article>
    <nav v-if="offset || more" class="rd-pagination"><button class="rd-button" :disabled="busy || !offset" @click="page(-30)">上一页</button><button class="rd-button" :disabled="busy || !more" @click="page(30)">下一页</button></nav>
  </section>
</template>
<script setup>
import { ref,reactive,onMounted,onUnmounted } from 'vue'
import { Check,X } from 'lucide-vue-next'
import { communityRequest } from '../lib/community-api.mjs'
const items=ref([]),status=ref('pending'),notes=reactive({}),offset=ref(0),more=ref(false),loading=ref(true),busy=ref(false),error=ref('')
const statuses=[{id:'pending',title:'待审核'},{id:'approved',title:'已通过'},{id:'rejected',title:'已拒绝'}]
let disposed=false,revision=0,subscription
async function load(){const request=++revision;loading.value=true;error.value='';try{const data=await communityRequest('/comments/reviews?status='+status.value+'&offset='+offset.value);if(disposed||request!==revision)return;items.value=data.items;more.value=data.has_more}catch(e){if(request===revision){error.value=e.message;items.value=[]}}finally{if(request===revision)loading.value=false}}
async function review(item,approved){if(busy.value)return;if(!approved&&!notes[item.id]?.trim()){error.value='请填写拒绝或下架说明';return}busy.value=true;try{await communityRequest('/comments/'+item.id+'/review',{method:'POST',body:{approved,note:notes[item.id]||''}});await load();window.dispatchEvent(new CustomEvent('rd:community-updated'))}catch(e){error.value=e.message}finally{busy.value=false}}
function changeStatus(value){status.value=value;offset.value=0;load()}
function page(delta){offset.value+=delta;load()}
onMounted(()=>{load();subscription=window.__api?.auth.onAuthStateChange(event=>{if(event!=='INITIAL_SESSION'){items.value=[];offset.value=0;load()}}).data.subscription})
onUnmounted(()=>{disposed=true;++revision;subscription?.unsubscribe()})
</script>
