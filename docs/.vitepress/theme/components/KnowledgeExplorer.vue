<template>
  <section class="rd-knowledge">
    <header class="rd-page-header"><div><p class="rd-eyebrow">CONNECTED KNOWLEDGE</p><h1>知识库</h1><p class="rd-page-subtitle">游戏创作，从一个知识点开始。</p></div><a class="rd-button rd-button-primary" href="/editor"><Plus :size="18" />分享笔记</a></header>
    <PageState v-if="loading" kind="loading" title="正在加载知识库" />
    <PageState v-else-if="error" kind="error" title="暂时无法加载" :message="error"><button class="rd-button" @click="load">重试</button></PageState>
    <template v-else>
      <div class="knowledge-toolbar"><div class="rd-segments" aria-label="知识库视图"><button :aria-pressed="mode==='graph'" @click="mode='graph'"><Network :size="17" />图谱</button><button :aria-pressed="mode==='list'" @click="mode='list'"><ListTree :size="17" />目录</button></div><span class="knowledge-count">{{ branches.length }} 个分支 · {{ articles.length }} 篇笔记</span><label class="rd-search"><Search :size="17" /><input v-model="search" type="search" aria-label="搜索知识节点" placeholder="搜索分支、笔记…"></label></div>
      <div class="knowledge-workspace">
        <main class="knowledge-main">
          <div v-show="mode==='graph'" class="knowledge-graph-wrap"><div ref="stage" class="knowledge-stage" role="img" aria-label="知识关系图谱，节点列表位于目录视图" /><p v-if="graphError" class="knowledge-fallback" role="alert">{{ graphError }} <button class="rd-button" @click="mode='list'">查看目录</button></p><div class="knowledge-zoom"><button class="rd-icon-button" aria-label="放大图谱" title="放大图谱" @click="zoom(1.25)"><ZoomIn :size="19" /></button><button class="rd-icon-button" aria-label="缩小图谱" title="缩小图谱" @click="zoom(.8)"><ZoomOut :size="19" /></button><button class="rd-icon-button" aria-label="查看全部节点" title="查看全部节点" @click="fit"><Scan :size="19" /></button></div></div>
          <div v-show="mode==='list' || search" class="knowledge-directory"><h2>{{ search ? '搜索结果' : '分支目录' }}</h2><p v-if="!results.length" class="knowledge-empty">没有找到匹配的节点</p><button v-for="node in results" :key="node.id" class="knowledge-directory-row" :style="{ paddingLeft: (10 + Math.min(node.depth || 0, 5) * 18) + 'px' }" :aria-pressed="selectedId===node.id" @click="select(node.id,true)"><FileText v-if="node.kind==='article'" :size="17" /><LibraryBig v-else :size="17" /><span><strong>{{ node.label }}</strong><small>{{ node.path || '全部分支' }}</small></span><ArrowUpRight :size="16" /></button></div>
          <section class="knowledge-reading"><header><h2>{{ selected?.kind==='article' ? '同分支笔记' : '分支笔记' }}</h2><span>{{ relatedArticles.length }} 篇</span></header><p v-if="!relatedArticles.length" class="knowledge-empty">这个分支还没有笔记。</p><ArticleCard v-for="article in relatedArticles" :key="article.id" :article="article" @tag="openTag" /></section>
        </main>
        <aside class="knowledge-inspector" aria-live="polite">
          <p class="rd-eyebrow">KNOWLEDGE EXPLORER</p><div class="knowledge-node-symbol"><Network :size="28" /></div>
          <p class="knowledge-path">{{ selected?.path || '全部分支' }}</p><h2>{{ selected?.label }}</h2>
          <a v-if="selected?.creator?.id" class="knowledge-creator" :href="'/user/profile?id='+encodeURIComponent(selected.creator.id)" :aria-label="'查看 '+nodeCreator(selected)+' 的个人主页'"><img :src="selected.creator.avatar_url || '/images/default-avatar.svg'" alt="" width="32" height="32" @error="avatarFallback"><span>{{ nodeCreator(selected) }}</span></a>
          <p v-else class="knowledge-creator"><UserRound :size="15" />{{ nodeCreator(selected) }}</p>
          <p class="knowledge-description">{{ selected?.description || selected?.summary || (selected?.kind==='root' ? '程序、美术、策划与创作实践。' : '积累实践，连接知识。') }}</p>
          <p v-if="isPinned" class="knowledge-pin-status"><Pin :size="15" />位置已固定</p>
          <div class="knowledge-actions">
            <a v-if="selected?.kind==='article'" class="rd-button rd-button-primary" :href="'/article?id='+encodeURIComponent(selected.sourceId)"><BookOpen :size="17" />阅读笔记</a>
            <button class="rd-button" @click="select(selectedId,true)"><LocateFixed :size="17" />定位节点</button>
            <button v-if="children.length && selected?.kind!=='article'" class="rd-button" @click="toggleCollapse"><component :is="collapsed.has(selectedId) ? ChevronDown : ChevronUp" :size="17" />{{ collapsed.has(selectedId) ? '展开' : '折叠' }}下级 · {{ children.length }}</button>
            <button v-if="isAdmin && selected?.kind!=='article'" class="rd-button rd-button-primary" @click="openCreate"><Plus :size="17" />添加子分支</button>
            <button v-if="isAdmin" class="rd-button" :disabled="nodeBusy || !graphReady || mode!=='graph'" @click="togglePin"><component :is="isPinned ? PinOff : Pin" :size="17" />{{ isPinned ? '取消固定' : '固定位置' }}</button>
            <button v-if="canDelete" class="rd-button knowledge-delete" :disabled="nodeBusy" @click="openDelete"><Trash2 :size="17" />删除节点</button>
            <a v-if="isAdmin" class="knowledge-admin-link" href="/admin/kb">管理知识库<ArrowUpRight :size="15" /></a>
          </div>
          <p v-if="nodeError" role="alert" class="knowledge-node-error">{{ nodeError }}</p>
          <h3>关联节点</h3><div class="knowledge-relations"><button v-if="parent" @click="select(parent.id,true)"><ArrowUp :size="16" />{{ parent.label }}</button><button v-for="node in children" :key="node.id" @click="select(node.id,true)"><ArrowDown :size="16" />{{ node.label }}</button><p v-if="!parent && !children.length" class="knowledge-empty">暂无关联节点</p></div>
        </aside>
      </div>
    </template>
    <dialog ref="dialog" class="knowledge-dialog" @cancel="onCancel"><form @submit.prevent="createBranch"><header><h2>添加子分支</h2><button type="button" class="rd-icon-button" aria-label="关闭" :disabled="saving" @click="dialog.close()"><X :size="19" /></button></header><p>上级：{{ createParent?.label }}</p><label>分支名称<input ref="nameInput" v-model="form.name" required maxlength="100" :disabled="saving"></label><label>说明<textarea v-model="form.description" rows="4" maxlength="2000" :disabled="saving" /></label><p v-if="saveError" role="alert">{{ saveError }}</p><button class="rd-button rd-button-primary" :disabled="saving">{{ saving ? '保存中…' : '创建分支' }}</button></form></dialog>
    <dialog ref="deleteDialog" class="knowledge-dialog" @cancel="cancelDelete"><form @submit.prevent="deleteNode"><header><h2>删除节点</h2><button type="button" class="rd-icon-button" aria-label="关闭删除确认" :disabled="nodeBusy" @click="deleteDialog.close()"><X :size="19" /></button></header><p>确定删除“{{ deleteTarget?.label }}”？</p><p>{{ deleteTarget?.kind==='branch' ? '下级分支和笔记将移到上一级，不会删除文章。' : '笔记将移出知识库，文章本身仍然保留。' }}</p><p v-if="nodeError" role="alert">{{ nodeError }}</p><button type="submit" class="rd-button rd-button-primary" :disabled="nodeBusy"><Trash2 :size="17" />{{ nodeBusy ? '处理中…' : '确认删除节点' }}</button></form></dialog>
  </section>
</template>
<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { ArrowDown, ArrowUp, ArrowUpRight, BookOpen, ChevronDown, ChevronUp, FileText, LibraryBig, ListTree, LocateFixed, Network, Pin, PinOff, Plus, Scan, Search, Trash2, UserRound, X, ZoomIn, ZoomOut } from 'lucide-vue-next'
import PageState from './PageState.vue'
import ArticleCard from './ArticleCard.vue'
import { knowledgeDescendants, knowledgeModel, knowledgeOutline, resolveKnowledge, visibleKnowledge } from '../knowledge.mjs'
import { knowledgeRequest } from '../lib/knowledge-api.mjs'
import { createKnowledgeMotion } from '../lib/knowledge-motion.mjs'
const branches=ref([]),articles=ref([]),loading=ref(true),error=ref(''),graphError=ref(''),user=ref(null),mode=ref('graph'),search=ref(''),selectedId=ref('root'),collapsed=ref(new Set()),stage=ref(null),dialog=ref(null),nameInput=ref(null),saving=ref(false),saveError=ref(''),createParent=ref(null),form=ref({name:'',description:''})
const creators=ref(new Map())
const nodes=computed(()=>knowledgeModel(branches.value,articles.value).map(node=>({...node,creator:creators.value.get(node.id)||null}))),selected=computed(()=>nodes.value.find(n=>n.id===selectedId.value)||nodes.value[0]),parent=computed(()=>nodes.value.find(n=>n.id===selected.value?.parent)),children=computed(()=>nodes.value.filter(n=>n.parent===selectedId.value)),isAdmin=computed(()=>user.value?.app_metadata?.role==='admin')
function nodeCreator(node){return node?.kind==='root'?'系统节点':node?.creator?.display_name||node?.creator?.username||'未记录'}
function avatarFallback(event){event.target.onerror=null;event.target.src='/images/default-avatar.svg'}
const pins=ref(new Map()),deleteDialog=ref(null),deleteTarget=ref(null),nodeBusy=ref(false),nodeError=ref(''),graphReady=ref(false)
const isPinned=computed(()=>pins.value.has(selectedId.value))
const canDelete=computed(()=>selected.value?.kind!=='root' && !!user.value && (isAdmin.value || (selected.value?.kind==='branch' ? selected.value.created_by : selected.value?.author_id)===user.value.id))
const results=computed(()=>search.value ? nodes.value.filter(n=>(n.label+' '+n.path).toLowerCase().includes(search.value.trim().toLowerCase())) : knowledgeOutline(visibleKnowledge(nodes.value,collapsed.value)))
const relatedArticles=computed(()=>{const id=selected.value?.kind==='article' ? selected.value.parent : selectedId.value;const ids=knowledgeDescendants(nodes.value,id);return nodes.value.filter(n=>n.kind==='article' && ids.has(n.id)).map(n=>({...n,id:n.sourceId}))})
let cy,motion,observer,subscription,request=0,disposed=false,graphRun=0,darkObserver
const positions=new Map()
async function allRows(table,columns,filters={},run=request) {const rows=[];for(;;){if(disposed||run!==request)return [];let q=window.__api.from(table).select(columns).order('id',{ascending:true}).limit(500).offset(rows.length);for(const [key,value] of Object.entries(filters))q=q.eq(key,value);const result=await q;if(result.error)throw new Error(result.error.message);rows.push(...(result.data||[]));if((result.data||[]).length<500)return rows}}
async function load(){const run=++request;++graphRun;motion?.destroy();motion=null;positions.clear();dialog.value?.close();deleteDialog.value?.close();deleteTarget.value=null;nodeError.value='';graphReady.value=false;loading.value=true;error.value='';cy?.destroy();cy=null
  try{if(!window.__api)throw new Error('无法连接知识库服务');const auth=await window.__api.auth.getUser();const b=await allRows('knowledge_branches','id,parent_id,name,description,sort_order,created_by');const a=await allRows('articles','id,title,summary,content,cover_url,tags,visibility,status,kb_enabled,created_at,likes_count,comments_count,kb_branch_id,kb_sort_order,author_id',{status:'published',kb_enabled:true});const [stored,credits]=await Promise.all([knowledgeRequest('/positions'),knowledgeRequest('/creators')]);if(disposed||run!==request)return;user.value=auth.data?.user;pins.value=new Map(stored.items.map(p=>[p.node_id,{x:p.x,y:p.y}]));creators.value=new Map(credits.items.map(c=>[c.node_id,c.creator]));branches.value=b.sort((x,y)=>(x.sort_order||0)-(y.sort_order||0));articles.value=a.sort((x,y)=>(x.kb_sort_order||0)-(y.kb_sort_order||0));const params=new URLSearchParams(location.search);selectedId.value=resolveKnowledge(nodes.value,params.get('branch')||params.get('path')||params.get('id')||'root').id;collapsed.value=new Set();loading.value=false;await renderGraph()}
  catch(cause){if(run===request&&!disposed)error.value=cause.message}finally{if(run===request&&!disposed)loading.value=false}
}
async function renderGraph(){const run=++graphRun;await nextTick();if(disposed||loading.value||error.value||!stage.value)return
  try{
    const {default:cytoscape}=await import('cytoscape');if(disposed||run!==graphRun)return
    motion?.destroy();motion=null;cy?.nodes?.().forEach(node=>positions.set(node.id(),{...node.position()}));cy?.destroy();graphError.value=''
    for(const [id,position] of pins.value)positions.set(id,position)
    const visible=visibleKnowledge(nodes.value,collapsed.value),ids=new Set(visible.map(n=>n.id))
    const layout=visible.every(n=>positions.has(n.id)) ? {name:'preset',padding:40} : {name:'cose',animate:false,nodeDimensionsIncludeLabels:true,nodeRepulsion:()=>8000,idealEdgeLength:()=>100,componentSpacing:80,padding:40,randomize:true,boundingBox:{x1:0,y1:0,w:Math.max(720,stage.value.clientWidth-100),h:Math.max(500,stage.value.clientHeight-100)}}
    cy=cytoscape({container:stage.value,elements:[...visible.map(n=>({data:{id:n.id,label:n.label,kind:n.kind},position:positions.get(n.id),locked:pins.value.has(n.id)})),...visible.filter(n=>ids.has(n.parent)).map(n=>({data:{id:'e:'+n.id,source:n.parent,target:n.id}}))],style:graphStyles(),layout,minZoom:.1,maxZoom:3})
    graphReady.value=true
    for(const [id] of pins.value){const node=cy.getElementById(id);node.unlock();if(!isAdmin.value)node.ungrabify()}
    if(stage.value.clientWidth<600){cy.zoom(Math.max(cy.zoom(),.8));cy.center(cy.getElementById(selectedId.value))}
    cy.on('tap','node',event=>select(event.target.id()));cy.on('mouseover','node',event=>highlight(event.target));cy.on('mouseout','node',()=>highlight());highlight()
    cy.on('dragfree','node',event=>{const node=event.target;if(isAdmin.value && pins.value.has(node.id()))savePin(node.id(),{...node.position()})})
    motion=createKnowledgeMotion(cy,stage.value)
  }
  catch{graphReady.value=false;graphError.value='图谱暂时无法显示，目录与笔记仍可正常阅读。'}
}
function graphStyles(){const dark=document.documentElement.classList.contains('dark');return [{selector:'node',style:{label:'data(label)','font-size':14,'text-wrap':'wrap','text-max-width':120,'text-valign':'bottom','text-margin-y':12,color:dark?'#d5d5d5':'#5c6064','background-color':dark?'#a1a1aa':'#70757a',width:16,height:16}},{selector:'node[kind="root"]',style:{width:32,height:32,'font-size':20,'font-weight':700}},{selector:'node[kind="branch"]',style:{width:24,height:24,'font-weight':600}},{selector:'edge',style:{width:1,'line-color':dark?'#4a4a50':'#e0e1e3','curve-style':'bezier'}},{selector:'.connected',style:{'background-color':'#b91c1c',color:dark?'#fafafa':'#991b1b','line-color':'#b91c1c'}},{selector:'.selected',style:{'border-color':'#ef4444','border-width':3,'border-opacity':.6}},{selector:'.muted',style:{opacity:.2}}]}
function highlight(node){if(!cy)return;cy.elements().removeClass('connected muted selected');cy.getElementById(selectedId.value).addClass('selected');if(node){const connected=node.closedNeighborhood();cy.elements().difference(connected).addClass('muted');connected.addClass('connected')}}
function select(id,focus=false){selectedId.value=id;let current=nodes.value.find(n=>n.id===id);const expand=new Set(collapsed.value);while(current?.parent){expand.delete(current.parent);current=nodes.value.find(n=>n.id===current.parent)}const changed=expand.size!==collapsed.value.size;collapsed.value=expand;const url=new URL(location.href);url.searchParams.delete('path');url.searchParams.delete('id');if(id==='root')url.searchParams.delete('branch');else url.searchParams.set('branch',nodes.value.find(n=>n.id===id)?.sourceId||id);history.replaceState(null,'',url);if(changed)renderGraph().then(()=>focus&&focusNode(id));else if(focus)focusNode(id);highlight()}
function focusNode(id){const node=cy?.getElementById(id);if(node?.length)cy.animate({center:{eles:node},zoom:Math.max(cy.zoom(),.8)},{duration:window.matchMedia('(prefers-reduced-motion: reduce)').matches?0:250})}
function fit(){cy?.fit(undefined,60)}
function openTag(tag){window.location.assign('/articles?tag='+encodeURIComponent(tag))}
function zoom(factor){if(cy)cy.zoom({level:cy.zoom()*factor,renderedPosition:{x:stage.value.clientWidth/2,y:stage.value.clientHeight/2}})}
function toggleCollapse(){const value=new Set(collapsed.value);value.has(selectedId.value)?value.delete(selectedId.value):value.add(selectedId.value);collapsed.value=value;renderGraph()}
function openCreate(){createParent.value=selected.value;form.value={name:'',description:''};saveError.value='';dialog.value.showModal();nextTick(()=>nameInput.value?.focus())}
function onCancel(event){if(saving.value)event.preventDefault()}
function openDelete(){if(!canDelete.value)return;deleteTarget.value={...selected.value};nodeError.value='';deleteDialog.value.showModal()}
function cancelDelete(event){if(nodeBusy.value)event.preventDefault()}
async function deleteNode(){if(nodeBusy.value||!deleteTarget.value)return;nodeBusy.value=true;nodeError.value='';const target=deleteTarget.value,run=request;try{const result=await knowledgeRequest('/nodes/'+encodeURIComponent(target.id),{method:'DELETE'});if(disposed||run!==request)return;deleteDialog.value.close();select(result.parent);await load()}catch(cause){if(run===request&&!disposed)nodeError.value=cause.message}finally{nodeBusy.value=false}}
async function savePin(id,position){if(nodeBusy.value||!isAdmin.value)return;nodeBusy.value=true;nodeError.value='';const run=request;try{const saved=await knowledgeRequest('/nodes/'+encodeURIComponent(id)+'/position',{method:'PUT',body:JSON.stringify(position)});if(disposed||run!==request)return;pins.value=new Map(pins.value).set(id,{x:saved.x,y:saved.y});positions.set(id,{x:saved.x,y:saved.y})}catch(cause){if(run===request&&!disposed){nodeError.value=cause.message;const previous=pins.value.get(id);if(previous)cy?.getElementById(id).position(previous)}}finally{nodeBusy.value=false}}
async function togglePin(){if(nodeBusy.value||!isAdmin.value||!cy)return;motion?.reset();const id=selectedId.value;if(!pins.value.has(id)){const position=cy.getElementById(id).position();if(position)await savePin(id,{...position});return}nodeBusy.value=true;nodeError.value='';const run=request;try{await knowledgeRequest('/nodes/'+encodeURIComponent(id)+'/position',{method:'DELETE'});if(disposed||run!==request)return;const next=new Map(pins.value);next.delete(id);pins.value=next;cy?.getElementById(id).unlock()}catch(cause){if(run===request&&!disposed)nodeError.value=cause.message}finally{nodeBusy.value=false}}
async function createBranch(){if(saving.value||!isAdmin.value)return;saving.value=true;saveError.value='';try{const name=form.value.name.trim();if(!name)throw new Error('请填写分支名称');const result=await window.__api.from('knowledge_branches').insert({name,slug:crypto.randomUUID(),description:form.value.description.trim(),parent_id:createParent.value.kind==='root'?null:createParent.value.sourceId,sort_order:0}).select('id').single();if(result.error)throw new Error(result.error.message);dialog.value.close();await load();select('b:'+result.data.id,true)}catch(cause){saveError.value=cause.message}finally{saving.value=false}}
watch(mode,async()=>{motion?.reset();await nextTick();if(mode.value==='graph'){cy?.resize();fit()}})
watch(nodeBusy,busy=>{if(busy)motion?.reset();const nodes=cy?.nodes?.();if(busy)nodes?.ungrabify();else {nodes?.grabify();if(!isAdmin.value)for(const [id] of pins.value)cy?.getElementById(id).ungrabify()}})
onMounted(()=>{load();subscription=window.__api?.auth.onAuthStateChange(event=>{if(event!=='INITIAL_SESSION')load()}).data.subscription;observer=new ResizeObserver(()=>cy?.resize());observer.observe(document.documentElement);darkObserver=new MutationObserver(()=>{cy?.style(graphStyles());highlight()});darkObserver.observe(document.documentElement,{attributes:true,attributeFilter:['class']})})
onUnmounted(()=>{disposed=true;++request;++graphRun;motion?.destroy();cy?.destroy();observer?.disconnect();darkObserver?.disconnect();subscription?.unsubscribe()})
</script>

<style scoped>
.knowledge-pin-status,.knowledge-creator{display:flex;align-items:center;gap:6px;color:var(--vp-c-text-2);font-size:13px}
.knowledge-creator{width:fit-content;max-width:100%;gap:10px;margin:16px 0;text-decoration:none}.knowledge-creator img{width:32px;height:32px;flex:none;border-radius:50%;object-fit:cover}.knowledge-creator span{overflow-wrap:anywhere}.knowledge-creator:hover{color:var(--vp-c-brand-1)}
.knowledge-actions .knowledge-delete,.knowledge-node-error{color:var(--vp-c-brand-1)}
</style>
