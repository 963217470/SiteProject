<template>
  <section class="rd-catalog">
    <header class="rd-page-header">
      <div><p class="rd-eyebrow">RD STUDIO</p><h1>游戏/工具</h1></div>
      <button v-if="user && !editing" class="rd-button rd-button-primary" :disabled="busy" @click="create"><Plus :size="16" />发布作品</button>
      <a v-else-if="!user" class="rd-button" href="/login">登录</a>
    </header>
    <p v-if="error" class="catalog-notice" role="alert">{{ error }}</p>
    <p v-if="message" class="catalog-notice" role="status">{{ message }}</p>
    <template v-if="editing">
      <form class="catalog-editor" @submit.prevent="save('pending')">
        <div class="catalog-editor-heading"><h2>{{ form.id ? '编辑作品' : '新作品' }}</h2><button type="button" class="rd-button" :disabled="busy" @click="cancelEdit"><ArrowLeft :size="16" />返回</button></div>
        <div class="catalog-fields">
          <label>名称<input v-model="form.title" maxlength="120" required :disabled="busy"></label>
          <label>分类<select v-model="form.kind" :disabled="busy"><option value="game">游戏</option><option value="tool">工具</option></select></label>
          <label>版本<input v-model="form.version" maxlength="60" :disabled="busy"></label>
          <label>平台<input v-model="form.platform" maxlength="120" :disabled="busy"></label>
          <label>许可/使用范围<input v-model="form.license" maxlength="120" :disabled="busy"></label>
        </div>
        <label>简介<textarea v-model="form.summary" rows="2" maxlength="300" :disabled="busy"></textarea></label>
        <div class="catalog-fields"><label>下载链接<input v-model="form.external_url" type="url" placeholder="https://pan.baidu.com/..." maxlength="2000" :disabled="busy"></label><label>提取码<input v-model="form.extraction_code" maxlength="100" :disabled="busy"></label></div>
        <div class="catalog-markdown-toolbar">
          <div class="rd-segments" aria-label="介绍视图"><button type="button" :aria-pressed="editorTab==='source'" @click="editorTab='source'">Markdown</button><button type="button" :aria-pressed="editorTab==='preview'" @click="editorTab='preview'">预览</button></div>
          <label class="rd-button catalog-file-button"><ImagePlus :size="16" />插入图片<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,image/avif" :disabled="busy" @change="upload($event,true)"></label>
          <label class="rd-button catalog-file-button"><FileUp :size="16" />导入 MD<input type="file" accept=".md,.markdown,text/markdown" :disabled="busy" @change="importMarkdown"></label>
        </div>
        <label v-if="editorTab==='source'">Markdown 介绍<textarea ref="source" v-model="form.content" class="catalog-source" rows="16" maxlength="200000" required :disabled="busy"></textarea></label>
        <div v-else class="catalog-prose vp-doc" v-html="preview"></div>
        <section class="catalog-attachments"><h3>文件附件</h3><label class="rd-button catalog-file-button"><Upload :size="16" />上传文件<input type="file" :disabled="busy" @change="upload($event,false)"></label>
          <div v-for="file in form.assets" :key="file.id" class="catalog-file-row"><span>{{ file.name }} <small>{{ bytes(file.size) }}</small></span><button v-if="file.mime.startsWith('image/')" type="button" class="rd-button" :disabled="busy" @click="form.cover_id=file.id">{{ form.cover_id===file.id ? '当前封面' : '设为封面' }}</button><button type="button" class="rd-button" :disabled="busy" :aria-label="'移除 '+file.name" @click="removeFile(file)"><X :size="16" /></button></div>
        </section>
        <footer class="catalog-editor-actions"><button type="button" class="rd-button" :disabled="busy" @click="save('draft')"><Save :size="16" />保存草稿</button><button class="rd-button rd-button-primary" :disabled="busy"><Send :size="16" />{{ user?.app_metadata?.role==='admin' ? '发布' : '提交审核' }}</button></footer>
      </form>
    </template>
    <template v-else-if="detail">
      <button class="rd-button" :disabled="busy" @click="back"><ArrowLeft :size="16" />作品列表</button>
      <article class="catalog-detail">
        <header><p class="catalog-meta">{{ detail.kind==='game' ? '游戏' : '工具' }} · {{ states[detail.status] }} · {{ detail.username }}</p><h2>{{ detail.title }}</h2><p>{{ detail.summary }}</p><div class="catalog-meta">{{ detail.version }} {{ detail.platform }} {{ detail.license }}</div></header>
        <img v-if="detail.cover_url" class="catalog-detail-cover" :src="detail.cover_url" :alt="detail.title">
        <div class="catalog-prose vp-doc" v-html="renderCatalogMarkdown(detail.content)"></div>
        <section class="catalog-downloads"><h3>下载</h3><p class="catalog-meta">下载访问 {{ detail.downloads }}</p><div v-if="detail.external_url" class="catalog-download-row"><button class="rd-button rd-button-primary" :disabled="busy || detail.status!=='published'" @click="download('external')"><ExternalLink :size="16" />外部下载</button><span>{{ host(detail.external_url) }}</span><span v-if="detail.extraction_code">提取码：{{ detail.extraction_code }}</span></div><div v-for="file in downloads" :key="file.id" class="catalog-download-row"><span>{{ file.name }} <small>{{ bytes(file.size) }}</small></span><button class="rd-button" :disabled="busy || detail.status!=='published'" @click="download(file.id)"><Download :size="16" />下载</button></div></section>
        <p v-if="detail.review_note" class="catalog-notice">审核意见：{{ detail.review_note }}</p>
        <div class="catalog-detail-actions"><button v-if="detail.author_id===user?.id" class="rd-button" :disabled="busy" @click="edit"><Pencil :size="16" />编辑</button><template v-if="user?.app_metadata?.role==='admin'"><label>审核意见<input v-model="reviewNote" maxlength="1000" :disabled="busy"></label><button v-if="detail.status==='pending'" class="rd-button rd-button-primary" :disabled="busy" @click="review('published')"><Check :size="16" />通过</button><button v-if="detail.status==='pending'" class="rd-button" :disabled="busy" @click="review('rejected')">拒绝</button><button v-if="detail.status==='published'" class="rd-button" :disabled="busy" @click="review('archived')">下架</button></template></div>
      </article>
    </template>
    <template v-else>
      <div class="catalog-filters"><div class="rd-segments" aria-label="作品分类"><button v-for="tab in kinds" :key="tab.id" :aria-pressed="kind===tab.id" :disabled="busy" @click="setFilter('kind',tab.id)">{{ tab.label }}</button></div><div v-if="user" class="rd-segments" aria-label="作品范围"><button :aria-pressed="scope==='public'" :disabled="busy" @click="setFilter('scope','public')">全部作品</button><button :aria-pressed="scope==='mine'" :disabled="busy" @click="setFilter('scope','mine')">我的发布</button><button v-if="user.app_metadata?.role==='admin'" :aria-pressed="scope==='review'" :disabled="busy" @click="setFilter('scope','review')">待审核</button></div><form class="catalog-search" @submit.prevent="search"><input v-model="query" aria-label="搜索作品" maxlength="100" type="search"><button class="rd-button" aria-label="搜索" title="搜索" :disabled="busy"><Search :size="17" /></button></form></div>
      <PageState v-if="loading" kind="loading" title="正在加载作品" />
      <PageState v-else-if="fatal" kind="error" title="暂时无法加载" :message="fatal"><button class="rd-button" @click="load">重试</button></PageState>
      <PageState v-else-if="!items.length" title="暂无作品" />
      <div v-else class="catalog-grid"><article v-for="row in items" :key="row.id" class="catalog-card"><button class="catalog-card-open" :disabled="busy" @click="open(row.id)"><img v-if="row.cover_url" :src="row.cover_url" :alt="row.title" loading="lazy"><div v-else class="catalog-cover-empty"><Gamepad2 v-if="row.kind==='game'" :size="42" /><Wrench v-else :size="42" /></div><div class="catalog-card-content"><div class="catalog-meta">{{ row.kind==='game' ? '游戏' : '工具' }} · {{ states[row.status] }}</div><h2>{{ row.title }}</h2><p>{{ row.summary }}</p><div class="catalog-meta">{{ row.platform }} {{ row.version }}</div><div class="catalog-card-footer"><span>{{ row.username }}</span><span><Download :size="14" />{{ row.downloads }}</span></div></div></button></article></div>
      <nav v-if="offset || hasMore" class="rd-pagination" aria-label="作品分页"><button class="rd-button" :disabled="busy || !offset" @click="page(-24)">上一页</button><span>{{ offset/24+1 }}</span><button class="rd-button" :disabled="busy || !hasMore" @click="page(24)">下一页</button></nav>
    </template>
  </section>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { ArrowLeft, Check, Download, ExternalLink, FileUp, Gamepad2, ImagePlus, Pencil, Plus, Save, Search, Send, Upload, Wrench, X } from 'lucide-vue-next'
import PageState from './PageState.vue'
import { catalogRequest, uploadCatalogFile, removeUnusedCatalogFiles } from '../lib/catalog-api.mjs'
import { renderCatalogMarkdown } from '../lib/catalog-markdown.mjs'

const kinds=[{id:'',label:'全部'},{id:'game',label:'游戏'},{id:'tool',label:'工具'}]
const states={draft:'草稿',pending:'待审核',published:'已发布',rejected:'未通过',archived:'已下架'}
const user=ref(null), items=ref([]), detail=ref(null), editing=ref(false), busy=ref(false), loading=ref(true), fatal=ref(''), error=ref(''), message=ref(''), kind=ref(''), scope=ref('public'), query=ref(''), offset=ref(0), hasMore=ref(false), editorTab=ref('source'), source=ref(null), reviewNote=ref('')
const empty=()=>({kind:'game',title:'',summary:'',content:'',version:'',platform:'',license:'',external_url:'',extraction_code:'',cover_id:null,assets:[]})
const form=ref(empty()), preview=computed(()=>renderCatalogMarkdown(form.value.content)), downloads=computed(()=>detail.value?.assets.filter(f=>!f.mime.startsWith('image/')) || [])
let revision=0, subscription, disposed=false
const bytes=n=>n>=1048576 ? (n/1048576).toFixed(1)+' MB' : Math.ceil(n/1024)+' KB'
const host=url=>{try{return new URL(url).hostname}catch{return ''}}
async function action(fn) { if(busy.value)return; busy.value=true; error.value='';message.value='';try{await fn()}catch(e){error.value=e.message}finally{busy.value=false} }
async function load() {
  const current=++revision;loading.value=true;fatal.value=''
  try{const data=await catalogRequest('?'+new URLSearchParams({scope:scope.value,kind:kind.value,q:query.value,offset:String(offset.value)}));if(current!==revision || disposed)return;items.value=data.items;hasMore.value=data.has_more}
  catch(e){if(current===revision)fatal.value=e.message}
  finally{if(current===revision)loading.value=false}
}
function setFilter(key,value){if(key==='scope')scope.value=value;else kind.value=value;offset.value=0;load()}
function search(){offset.value=0;load()}
function page(amount){offset.value+=amount;load()}
function create(){form.value=empty();editing.value=true;detail.value=null;error.value='';message.value='';editorTab.value='source'}
function edit(){form.value={...detail.value,assets:detail.value.assets.map(f=>({...f}))};editing.value=true;editorTab.value='source'}
async function cancelEdit(){if(!window.confirm('放弃本次未保存的修改？'))return;await action(async()=>{await removeUnusedCatalogFiles(form.value.assets.filter(f=>f.newUpload).map(f=>f.path));editing.value=false;form.value=empty()})}
function back(){detail.value=null;error.value='';if(typeof window!=='undefined')history.replaceState(null,'',location.pathname);load()}
async function open(id){await action(async()=>{const current=revision, result=await catalogRequest('/'+encodeURIComponent(id));if(disposed || current!==revision)return;detail.value=result;reviewNote.value='';history.replaceState(null,'','#'+id)})}
async function save(status){await action(async()=>{
  if(!form.value.title.trim() || !form.value.content.trim())throw new Error('请填写名称和 Markdown 介绍')
  const current=revision, f=form.value, result=await catalogRequest(f.id?'/'+f.id:'',{method:f.id?'PUT':'POST',body:{...f,assets:f.assets.map(a=>a.id),status:status==='pending' && user.value?.app_metadata?.role==='admin'?'published':status}})
  const saved=await catalogRequest('/'+result.id);if(disposed || current!==revision)return;detail.value=saved;editing.value=false;form.value=empty();history.replaceState(null,'','#'+result.id);message.value=result.status==='published'?'作品已发布':result.status==='draft'?'草稿已保存':'已提交审核'
})}
async function upload(event,image){const file=event.target.files?.[0];event.target.value='';if(!file)return;await action(async()=>{
  if(form.value.assets.length>=20)throw new Error('最多关联 20 个文件')
  const start=source.value?.selectionStart ?? form.value.content.length, end=source.value?.selectionEnd ?? start
  const current=revision, result=await uploadCatalogFile(file,user.value.id);if(disposed || current!==revision){await removeUnusedCatalogFiles([result.path]);return}form.value.assets.push({...result,newUpload:true})
  if(image){if(!result.mime.startsWith('image/'))throw new Error('文件不是支持的图片格式');const insertion='\n!['+file.name.replace(/[\[\]\\]/g,'')+']('+result.url+')\n';form.value.content=form.value.content.slice(0,start)+insertion+form.value.content.slice(end);form.value.cover_id ||= result.id}
})}
async function removeFile(file){if(form.value.content.includes(file.url)){error.value='请先移除正文中的图片引用';return}await action(async()=>{if(file.newUpload)await removeUnusedCatalogFiles([file.path]);form.value.assets=form.value.assets.filter(f=>f.id!==file.id);if(form.value.cover_id===file.id)form.value.cover_id=null})}
async function importMarkdown(event){const file=event.target.files?.[0];event.target.value='';if(!file)return;await action(async()=>{if(file.size>800000)throw new Error('Markdown 文件过大');if(form.value.content && !window.confirm('替换当前 Markdown 介绍？'))return;const content=await file.text();if(content.length>200000)throw new Error('Markdown 介绍过长');form.value.content=content;editorTab.value='source'})}
async function download(target){await action(async()=>{const current=revision, result=await catalogRequest('/'+detail.value.id+'/download',{method:'POST',body:{target}});if(disposed || current!==revision)return;detail.value.downloads=result.downloads;window.location.assign(result.url)})}
async function review(status){await action(async()=>{const current=revision,id=detail.value.id;await catalogRequest('/'+id+'/review',{method:'POST',body:{status,note:reviewNote.value,revision:detail.value.revision}});const result=await catalogRequest('/'+id);if(disposed || current!==revision)return;detail.value=result;message.value='审核状态已更新'})}
function protectEdits(event){if(editing.value){event.preventDefault();event.returnValue=''}}
onMounted(()=>{
  window.addEventListener('beforeunload',protectEdits)
  const initialize=async(session)=>{if(disposed)return;user.value=session?.user || null;++revision;detail.value=null;editing.value=false;form.value=empty();scope.value='public';offset.value=0;await load();const id=location.hash.slice(1)||new URLSearchParams(location.search).get('id')||'';if(/^[a-zA-Z0-9-]{1,100}$/.test(id))await open(id)}
  if(window.__api)subscription=window.__api.auth.onAuthStateChange((_event,session)=>initialize(session)).data.subscription
  else initialize(null)
})
onUnmounted(()=>{disposed=true;++revision;subscription?.unsubscribe();window.removeEventListener('beforeunload',protectEdits)})
</script>
