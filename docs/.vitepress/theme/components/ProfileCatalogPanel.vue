<template>
  <Teleport v-if="active" to="#panel-catalog">
    <section class="profile-catalog" aria-label="我的游戏与工具">
      <header class="profile-catalog-heading"><h2>我的游戏/工具</h2><a class="rd-button rd-button-primary" href="/games-tools/?create=1"><Plus :size="16" />发布作品</a></header>
      <form class="profile-catalog-filters" @submit.prevent="filter">
        <select v-model="kind" aria-label="我的作品分类" :disabled="busy || loading" @change="filter"><option value="">全部分类</option><option value="game">游戏</option><option value="tool">工具</option></select>
        <input v-model="query" aria-label="搜索我的游戏或工具" type="search" maxlength="100" :disabled="busy" placeholder="搜索作品">
        <button class="rd-icon-button" aria-label="搜索我的作品" title="搜索" :disabled="busy || loading"><Search :size="18" /></button>
      </form>
      <p v-if="error" class="profile-catalog-error" role="alert">{{ error }} <button v-if="!busy" class="rd-button" :disabled="loading" @click="load">重试</button></p>
      <p v-if="message" role="status">{{ message }}</p>
      <p v-if="!uid">请先登录后查看自己的作品。</p>
      <p v-else-if="loading" role="status">正在加载作品…</p>
      <div v-else-if="!rows.length && !error" class="profile-catalog-empty">暂无{{ kind==='game' ? '游戏' : kind==='tool' ? '工具' : '作品' }}</div>
      <div v-else class="profile-catalog-list">
        <article v-for="row in rows" :key="row.id" class="profile-catalog-card">
          <a :href="viewUrl(row)" class="profile-catalog-cover"><img v-if="row.cover_url && !failedImages[row.cover_url]" :src="row.cover_url" :alt="row.title" loading="lazy" @error="failedImages[row.cover_url]=true"><Gamepad2 v-else-if="row.kind==='game'" :size="36" /><Wrench v-else :size="36" /></a>
          <div class="profile-catalog-content"><div class="profile-catalog-meta"><span>{{ row.kind==='game' ? '游戏' : '工具' }}</span><span class="profile-catalog-status" :data-status="row.status">{{ states[row.status] || row.status }}</span></div><h3><a :href="viewUrl(row)">{{ row.title }}</a></h3><p>{{ row.summary || '暂无简介' }}</p><small>{{ row.platform }} {{ row.version }} · 下载访问 {{ row.downloads || 0 }}</small><small>更新于 {{ date(row.updated_at) }}</small>
            <div class="profile-catalog-actions"><a class="rd-button" :href="viewUrl(row)"><Eye :size="15" />查看</a><a class="rd-button" :href="editUrl(row)"><Pencil :size="15" />编辑</a><button v-if="canWithdraw(row)" class="rd-button" :disabled="busy || loading" @click="withdraw(row)"><Undo2 :size="15" />撤回</button></div>
          </div>
        </article>
      </div>
      <nav v-if="offset || hasMore" class="profile-catalog-pages" aria-label="我的作品分页"><button class="rd-button" :disabled="loading || busy || !offset" @click="page(-24)">上一页</button><span>{{ offset/24+1 }}</span><button class="rd-button" :disabled="loading || busy || !hasMore" @click="page(24)">下一页</button></nav>
    </section>
  </Teleport>
</template>

<script setup>
import { onMounted, onUnmounted, reactive, ref } from 'vue'
import { Eye, Gamepad2, Pencil, Plus, Search, Undo2, Wrench } from 'lucide-vue-next'
import { catalogRequest } from '../lib/catalog-api.mjs'

const active=ref(false),uid=ref(''),rows=ref([]),kind=ref(''),query=ref(''),offset=ref(0),hasMore=ref(false),loading=ref(false),busy=ref(false),error=ref(''),message=ref(''),failedImages=reactive({})
const states={draft:'草稿',pending:'待审核',published:'已发布',rejected:'未通过',archived:'已下架'}
const viewUrl=row=>'/games-tools/?id='+encodeURIComponent(row.id)
const editUrl=row=>viewUrl(row)+'&edit=1'
const canWithdraw=row=>['published','pending'].includes(row.status)
const date=value=>value ? new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}) : '未知时间'
let revision=0,subscription,disposed=false
async function load(){
  if(!uid.value || !active.value || disposed)return
  const run=++revision,owner=uid.value;loading.value=true;error.value=''
  try{
    const data=await catalogRequest('?'+new URLSearchParams({scope:'mine',kind:kind.value,q:query.value,offset:String(offset.value)}))
    if(disposed || run!==revision || owner!==uid.value)return
    rows.value=data.items;hasMore.value=data.has_more
    if(!rows.value.length && offset.value){offset.value=Math.max(0,offset.value-24);return load()}
  }catch(cause){if(run===revision && !disposed)error.value=cause.message}
  finally{if(run===revision)loading.value=false}
}
function filter(){if(busy.value || loading.value)return;offset.value=0;message.value='';load()}
function page(amount){offset.value+=amount;load()}
async function withdraw(row){
  if(busy.value || loading.value || !canWithdraw(row))return
  if(!window.confirm('将“'+row.title+'”撤回为草稿？撤回后不再公开展示或提供下载，介绍、附件和下载路径会保留。'))return
  const owner=uid.value,run=revision;busy.value=true;error.value='';message.value=''
  try{
    await catalogRequest('/'+encodeURIComponent(row.id)+'/withdraw',{method:'POST',body:{revision:row.revision}})
    if(disposed || owner!==uid.value || run!==revision)return
    message.value='作品已撤回为草稿，可编辑后重新提交';await load()
  }catch(cause){if(!disposed && owner===uid.value && run===revision){if(cause.status===409)await load();error.value=cause.message}}
  finally{if(!disposed && owner===uid.value)busy.value=false}
}
function update(){
  const panel=document.getElementById('panel-catalog'),wasActive=active.value
  active.value=Boolean(panel && panel.style.display!=='none' && document.getElementById('profile-app')?.style.display!=='none' && !new URLSearchParams(location.search).get('id'))
  if(active.value && !wasActive)load()
  if(!active.value){++revision;loading.value=false}
}
onMounted(()=>{
  window.addEventListener('rd:profile-tab',update);update()
  if(window.__api)subscription=window.__api.auth.onAuthStateChange((_event,session)=>{
    if(disposed)return
    const owner=session?.user?.id || ''
    if(owner!==uid.value){++revision;uid.value=owner;rows.value=[];offset.value=0;hasMore.value=false;error.value='';message.value='';busy.value=false;loading.value=false;if(active.value)load()}
  }).data.subscription
})
onUnmounted(()=>{disposed=true;++revision;subscription?.unsubscribe();window.removeEventListener('rd:profile-tab',update)})
</script>

<style scoped>
.profile-catalog { min-width:0; }
.profile-catalog-heading,.profile-catalog-filters,.profile-catalog-meta,.profile-catalog-actions,.profile-catalog-pages { display:flex;align-items:center;gap:10px;flex-wrap:wrap; }
.profile-catalog-heading { justify-content:space-between;margin-bottom:20px; }
.profile-catalog-heading h2 { margin:0;font-size:22px;font-weight:650; }
.profile-catalog-filters { margin-bottom:20px; }
.profile-catalog-filters input,.profile-catalog-filters select { min-height:40px;border:1px solid var(--vp-c-divider);border-radius:6px;padding:8px 10px;background:var(--vp-c-bg);color:var(--vp-c-text-1);font:inherit;min-width:0; }
.profile-catalog-filters input { flex:1;width:180px; }
.profile-catalog-filters select { max-width:100%;appearance:auto; }
.profile-catalog-list { display:grid;gap:16px; }
.profile-catalog-card { display:grid;grid-template-columns:180px minmax(0,1fr);border:1px solid var(--vp-c-divider);border-radius:8px;overflow:hidden;background:var(--vp-c-bg); }
.profile-catalog-cover { min-width:0;aspect-ratio:4/3;display:grid;place-items:center;align-self:start;background:var(--vp-c-bg-soft);color:var(--vp-c-brand-1); }
.profile-catalog-cover img { width:100%;height:100%;object-fit:contain; }
.profile-catalog-content { display:grid;gap:8px;padding:16px;min-width:0; }
.profile-catalog-content h3 { margin:0;font-size:18px;font-weight:600;overflow-wrap:anywhere; }
.profile-catalog-content p { margin:0;color:var(--vp-c-text-2);overflow-wrap:anywhere;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden; }
.profile-catalog-content small,.profile-catalog-meta { font-size:13px;color:var(--vp-c-text-2);overflow-wrap:anywhere; }
.profile-catalog-status { padding:2px 6px;border-radius:4px;background:var(--vp-c-bg-soft); }
.profile-catalog-status[data-status=published] { color:#246348;background:#eaf5ee; }
.profile-catalog-status[data-status=pending] { color:#735918;background:#fff6d7; }
.profile-catalog-status[data-status=rejected],.profile-catalog-error { color:var(--vp-c-brand-1); }
.profile-catalog-actions { margin-top:4px; }
.profile-catalog-actions .rd-button { min-height:36px;padding:6px 10px; }
.profile-catalog-pages { justify-content:space-between;margin-top:20px; }
.profile-catalog-empty { padding:32px 12px;text-align:center;color:var(--vp-c-text-2); }
@media(max-width:700px) { .profile-catalog-card { grid-template-columns:minmax(0,1fr); }.profile-catalog-cover { aspect-ratio:16/9;max-height:220px; }.profile-catalog-filters input { width:120px; } }
</style>
