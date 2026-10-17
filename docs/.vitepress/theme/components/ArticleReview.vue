<template>
  <section id="admin-page" class="article-review">
    <header class="review-page-head"><div><p class="review-eyebrow">管理后台</p><h1>文章审核</h1></div><div class="review-actions"><button class="rd-button" :disabled="busy || loading" @click="checkConnection"><RotateCw :size="16" />测试连接</button><a class="rd-button" href="/articles/">返回文章列表</a></div></header>
    <PageState v-if="loading" kind="loading" title="正在加载审核队列" />
    <PageState v-else-if="denied" kind="error" title="需要管理员权限"><a class="rd-button" href="/login/">登录</a></PageState>
    <template v-else>
      <p v-if="error" role="alert" class="review-error">{{ error }} <button v-if="!busy" class="rd-button" @click="load">重试</button></p>
      <p v-if="message" role="status">{{ message }}</p>
      <section class="review-metrics" aria-label="审核统计"><div v-for="tab in tabs" :key="tab.id"><strong>{{ counts[tab.id] }}</strong><span>{{ tab.label === '全部' ? '全部文章' : tab.label }}</span></div></section>
      <nav class="review-filters rd-segments" aria-label="审核筛选"><button v-for="tab in tabs" :key="tab.id" :aria-pressed="filter===tab.id" :disabled="busy" @click="changeFilter(tab.id)">{{ tab.label }}</button><button aria-label="刷新审核队列" title="刷新审核队列" :disabled="busy" @click="load"><RotateCw :size="16" /></button></nav>
      <PageState v-if="!items.length && !error" title="暂无对应文章" />
      <div class="review-entries"><article v-for="article in items" :key="article.id" class="review-entry">
        <div class="review-entry-body"><div class="review-entry-heading"><button class="review-title" @click="openPreview(article)">{{ article.title }}</button><span class="review-status" :class="'review-status-'+article.status">{{ statusText(article.status) }}</span></div><p class="review-entry-meta">提交 {{ date(article.created_at) }} · 更新 {{ date(article.updated_at) }} · {{ article.visibility==='internal' ? '内部' : '公开' }}</p><p class="review-entry-summary">{{ article.summary || '暂无摘要' }}</p><p v-if="article.reject_reason" class="review-error">拒绝原因：{{ article.reject_reason }}</p></div>
        <div class="review-actions review-entry-actions"><button class="rd-button" :disabled="busy" @click="openPreview(article)"><Eye :size="16" />查看正文</button><button v-if="article.status!=='published'" class="rd-button review-approve" :disabled="busy" @click="decide(article,'published')"><Check :size="16" />{{ article.status==='pending' ? '通过' : '直接发布' }}</button><button v-if="article.status==='pending'" class="rd-button" :disabled="busy" @click="decide(article,'rejected')"><X :size="16" />拒绝</button><button v-if="article.status==='published'" class="rd-button" :disabled="busy" @click="decide(article,'pending')"><Undo2 :size="16" />撤回</button><button class="rd-icon-button review-delete" title="删除文章" :aria-label="'删除文章：'+article.title" :disabled="busy" @click="remove(article)"><Trash2 :size="17" /></button></div>
      </article></div>
      <nav v-if="offset || more" class="review-pagination" aria-label="审核分页"><button class="rd-button" :disabled="busy || !offset" @click="page(-30)">上一页</button><span>第 {{ offset/30+1 }} 页</span><button class="rd-button" :disabled="busy || !more" @click="page(30)">下一页</button></nav>
    </template>
    <dialog ref="dialog" class="review-preview" aria-labelledby="review-preview-title" @cancel="cancel" @click="event=>event.target===dialog && closePreview()">
      <header class="review-preview-head"><h2 id="review-preview-title">{{ detail?.title || '文章预览' }}</h2><button class="rd-icon-button" title="关闭预览" aria-label="关闭预览" :disabled="busy" @click="closePreview"><X :size="20" /></button></header>
      <p v-if="previewLoading" role="status">正在读取完整正文…</p>
      <p v-if="previewError" role="alert" class="review-error">{{ previewError }} <button v-if="selected" class="rd-button" @click="openPreview(selected)">重试</button></p>
      <template v-if="detail">
        <p class="review-entry-meta">{{ statusText(detail.status) }} · {{ detail.visibility==='internal' ? '内部文章' : '公开文章' }} · 更新 {{ date(detail.updated_at) }}</p>
        <p v-if="detail.reject_reason" class="review-error">拒绝原因：{{ detail.reject_reason }}</p>
        <div class="rd-segments" aria-label="正文视图"><button :aria-pressed="previewMode==='rendered'" @click="previewMode='rendered'">正文预览</button><button :aria-pressed="previewMode==='source'" @click="previewMode='source'">Markdown 原文</button></div>
        <div v-if="previewMode==='rendered'" class="review-preview-content rd-markdown" aria-label="审核正文" @copy="copyMarkdownSelection" v-html="html"></div>
        <textarea v-else class="review-source" aria-label="Markdown 原文" :value="detail.content" readonly spellcheck="false"></textarea>
        <footer class="review-preview-footer"><a class="rd-button" :href="'/article?id='+encodeURIComponent(detail.id)">打开文章页</a><button v-if="detail.status==='pending'" class="rd-button review-approve" :disabled="busy" @click="decide(detail,'published')"><Check :size="16" />通过并发布</button><button v-if="detail.status==='pending'" class="rd-button" :disabled="busy" @click="decide(detail,'rejected')"><X :size="16" />拒绝</button></footer>
      </template>
    </dialog>
  </section>
</template>
<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref } from 'vue'
import { Check, Eye, RotateCw, Trash2, Undo2, X } from 'lucide-vue-next'
import PageState from './PageState.vue'
import { communityRequest } from '../lib/community-api.mjs'
import { renderArticleMarkdown } from '../lib/markdown.mjs'
import { copyMarkdownSelection } from '../lib/markdown-copy.mjs'
import '../markdown.css'
const items=ref([]), counts=ref({pending:0,published:0,rejected:0,all:0}), filter=ref('pending'), offset=ref(0), more=ref(false), loading=ref(true), busy=ref(false), denied=ref(false), error=ref(''), message=ref('')
const dialog=ref(null), detail=ref(null), selected=ref(null), previewLoading=ref(false), previewError=ref(''), previewMode=ref('rendered')
const tabs=[{id:'pending',label:'待审核'},{id:'published',label:'已发布'},{id:'rejected',label:'已拒绝'},{id:'all',label:'全部'}]
const statusText=status=>({draft:'草稿',pending:'待审核',published:'已发布',rejected:'已拒绝'}[status]||status)
const date=value=>value?new Date(value).toLocaleString('zh-CN'):'未记录'
const html=computed(()=>renderArticleMarkdown(detail.value?.content||''))
let disposed=false, listRevision=0, previewRevision=0, subscription
async function query(status,limit,start=0) {
  const params=new URLSearchParams({select:'id,title,summary,status,visibility,created_at,updated_at,reject_reason',order:'created_at.desc',limit:String(limit),offset:String(start)})
  if(status!=='all')params.set('status','eq.'+status)
  const response=await fetch('/api/data/articles?'+params,{credentials:'same-origin',headers:{Prefer:'count=exact'}})
  const data=await response.json()
  if(!response.ok)throw Object.assign(new Error(data.message||'无法加载审核队列'),{status:response.status})
  return {rows:data,count:Number(response.headers.get('content-range')?.split('/')[1]||0)}
}
async function load() {
  const run=++listRevision;loading.value=true;error.value='';denied.value=false
  try {
    const {session}=await communityRequest('/auth/session')
    if(!session || session.user.app_metadata?.role!=='admin')throw Object.assign(new Error('需要管理员权限'),{status:403})
    const [list,...stats]=await Promise.all([query(filter.value,31,offset.value),...tabs.map(tab=>query(tab.id,0))])
    if(disposed || run!==listRevision)return
    items.value=list.rows.slice(0,30);more.value=list.rows.length>30
    counts.value=Object.fromEntries(tabs.map((tab,index)=>[tab.id,stats[index].count]))
  } catch(e){if(disposed || run!==listRevision)return;items.value=[];denied.value=[401,403].includes(e.status);error.value=e.message}
  finally{if(!disposed && run===listRevision)loading.value=false}
}
function changeFilter(value){filter.value=value;offset.value=0;load()}
function page(delta){offset.value=Math.max(0,offset.value+delta);load()}
async function checkConnection(){await load();if(!error.value && !denied.value)message.value='连接正常，当前共有 '+counts.value.all+' 篇文章'}
async function openPreview(article) {
  if(busy.value)return
  const run=++previewRevision;selected.value=article;detail.value=null;previewError.value='';previewLoading.value=true;previewMode.value='rendered'
  await nextTick();if(disposed || run!==previewRevision)return;if(!dialog.value.open)dialog.value.showModal()
  try {
    const rows=await communityRequest('/data/articles?'+new URLSearchParams({id:'eq.'+article.id,select:'id,title,summary,content,status,visibility,updated_at,reject_reason',limit:'1'}))
    if(disposed || run!==previewRevision)return
    if(!rows.length)throw new Error('文章已不存在，或当前账号没有查看权限')
    detail.value=rows[0]
    const row=items.value.find(item=>item.id===article.id);if(row)Object.assign(row,rows[0])
  } catch(e){if(!disposed && run===previewRevision)previewError.value=e.message}
  finally{if(!disposed && run===previewRevision)previewLoading.value=false}
}
function closePreview(){if(busy.value)return;++previewRevision;dialog.value?.close();detail.value=null;previewLoading.value=false;previewError.value=''}
function cancel(event){if(busy.value)event.preventDefault();else closePreview()}
async function mutate(article,method,body) {
  if(busy.value)return
  busy.value=true;error.value='';message.value='';previewError.value=''
  try {
    const params=new URLSearchParams({id:'eq.'+article.id,status:'eq.'+article.status,select:'id'})
    if(article.updated_at)params.set('updated_at','eq.'+article.updated_at)
    const rows=await communityRequest('/data/articles?'+params,{method,...(body?{body}: {})})
    if(!rows.length)throw new Error('文章已被修改或处理，请刷新后重新查看正文')
    busy.value=false;closePreview();message.value=method==='DELETE'?'文章已删除':'审核状态已更新'
    if(items.value.length===1 && offset.value)offset.value=Math.max(0,offset.value-30)
    await load();window.dispatchEvent(new CustomEvent('rd:community-updated'))
  } catch(e){if(!disposed){error.value=e.message;if(dialog.value?.open)previewError.value=e.message}}
  finally{if(!disposed)busy.value=false}
}
async function decide(article,status) {
  if(busy.value)return
  let reason=''
  if(status==='rejected'){reason=window.prompt('请输入拒绝原因（可选）');if(reason===null)return}
  else if(!window.confirm(status==='published'?'确定通过并发布这篇文章吗？':'确定撤回发布，让文章回到待审核吗？'))return
  const body={status,updated_at:new Date().toISOString(),reject_reason:status==='rejected'?reason:null}
  if(status==='published')body.published_at=new Date().toISOString()
  await mutate(article,'PATCH',body)
}
function remove(article){if(!busy.value && window.confirm('永久删除《'+article.title+'》？此操作不可恢复。'))return mutate(article,'DELETE')}
onMounted(()=>{load();subscription=window.__api?.auth.onAuthStateChange(event=>{if(event!=='INITIAL_SESSION'){++previewRevision;dialog.value?.close();detail.value=null;selected.value=null;items.value=[];counts.value={pending:0,published:0,rejected:0,all:0};load()}}).data.subscription})
onUnmounted(()=>{disposed=true;++listRevision;++previewRevision;subscription?.unsubscribe();dialog.value?.close()})
</script>
<style scoped>
.article-review{width:min(1180px,100%);margin:auto;padding:32px 24px 64px;min-width:0;color:var(--vp-c-text-1)}
.review-page-head{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:24px}.review-page-head h1{font-size:30px;line-height:1.4;margin:0}.review-eyebrow{font-size:12px;color:var(--vp-c-brand-1);margin:0 0 6px}.review-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.review-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px;padding:24px 0;border-block:1px solid var(--vp-c-divider)}.review-metrics div{display:grid;gap:6px}.review-metrics strong{font-size:24px}.review-metrics span,.review-entry-meta{font-size:13px;color:var(--vp-c-text-2)}.review-filters{margin:24px 0;flex-wrap:wrap}.review-entry{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:24px;align-items:start;padding:24px 0;border-bottom:1px solid var(--vp-c-divider)}.review-entry-body{min-width:0}.review-entry-heading{display:flex;gap:12px;align-items:baseline;flex-wrap:wrap}.review-title{font-size:18px;font-weight:650;line-height:1.5;text-align:left;overflow-wrap:anywhere;color:inherit;cursor:pointer}.review-title:hover{color:var(--vp-c-brand-1)}.review-entry-meta{line-height:1.7;margin:8px 0;overflow-wrap:anywhere}.review-entry-summary{line-height:1.7;color:var(--vp-c-text-2);font-size:14px;overflow-wrap:anywhere;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:3;overflow:hidden;margin:8px 0}.review-entry-actions{max-width:320px;justify-content:flex-end}.review-status{display:inline-block;padding:3px 8px;border-radius:4px;font-size:12px;white-space:nowrap;background:var(--vp-c-bg-soft)}.review-status-pending{color:#805b12;background:#fff3c4}.review-status-published{color:#21634b;background:#e0f2e9}.review-status-rejected{color:#a72d28;background:#fbe8e7}.review-approve{color:#21634b;border-color:#90bda9;background:#e8f5ee}.review-error,.review-delete{color:#b42e28}.review-error{overflow-wrap:anywhere}.review-pagination{display:flex;justify-content:space-between;align-items:center;margin-top:24px;gap:16px}
.review-preview{width:min(1000px,calc(100vw - 32px));max-height:calc(100dvh - 40px);margin:auto;padding:24px;border:1px solid var(--vp-c-divider);border-radius:8px;color:var(--vp-c-text-1);background:var(--vp-c-bg);overflow:auto}.review-preview::backdrop{background:#0007}.review-preview-head{display:flex;align-items:flex-start;justify-content:space-between;gap:16px}.review-preview-head h2{font-size:22px;line-height:1.5;margin:0;overflow-wrap:anywhere}.review-preview-head button{flex:none}.review-preview-content{padding:16px 0}.review-preview-footer{display:flex;gap:12px;flex-wrap:wrap;padding-top:16px;border-top:1px solid var(--vp-c-divider)}.review-source{width:100%;min-height:360px;padding:16px;margin:16px 0;border:1px solid var(--vp-c-divider);border-radius:6px;background:var(--vp-c-bg-soft);color:inherit;font:14px/1.7 monospace;resize:vertical;white-space:pre;overflow:auto}
@media(max-width:900px){.review-entry{grid-template-columns:minmax(0,1fr);gap:12px}.review-entry-actions{max-width:none;justify-content:flex-start}}@media(max-width:600px){.article-review{padding:24px 16px 48px}.review-page-head{align-items:flex-start;flex-direction:column}.review-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.review-preview{padding:16px}.review-preview-head h2{font-size:19px}}
</style>
