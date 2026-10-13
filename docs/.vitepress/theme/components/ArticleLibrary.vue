<template>
  <section class="rd-library" :class="{ 'rd-library-compact': compact }">
    <div class="article-community-layout"><div class="article-community-main">
    <header class="rd-page-header"><div><p class="rd-eyebrow">{{ compact ? 'RD STUDIO' : 'WHAT’S HAPPENING' }}</p><h1 v-if="!compact">文章与讨论</h1><h2 v-else>最新发布</h2></div><a :href="compact ? '/articles' : '/editor'" class="rd-button" :class="{ 'rd-button-primary': !compact }"><ArrowUpRight v-if="compact" :size="17" aria-hidden="true" /><Plus v-else :size="17" aria-hidden="true" />{{ compact ? '全部文章' : '发布文章' }}</a></header>
    <div v-if="!compact" class="rd-library-toolbar">
      <div class="rd-segments" role="group" aria-label="文章可见性"><button v-for="option in filters" :key="option.value" type="button" :aria-pressed="filter === option.value" @click="filter = option.value">{{ option.label }}</button></div>
      <label class="rd-search"><Search :size="17" aria-hidden="true" /><input v-model="search" type="search" placeholder="搜索文章或标签" aria-label="搜索文章或标签"></label>
      <label class="rd-sort"><span class="rd-sr-only">排序</span><select v-model="sort" aria-label="文章排序"><option value="new">最新发布</option><option value="popular">最多点赞</option><option value="discussed">最多评论</option></select></label>
      <div class="rd-segments rd-view-modes" role="group" aria-label="显示方式"><button type="button" :aria-pressed="mode === 'list'" aria-label="列表视图" title="列表视图" @click="mode = 'list'"><List :size="18" aria-hidden="true" /></button><button type="button" :aria-pressed="mode === 'grid'" aria-label="网格视图" title="网格视图" @click="mode = 'grid'"><LayoutGrid :size="18" aria-hidden="true" /></button></div>
    </div>
    <a v-if="!compact" class="article-community-welcome" href="/about/"><Sparkles :size="18" aria-hidden="true" /><span>欢迎来到 RD STUDIO，把想法、经验和创作中的每一步留在这里。</span><ArrowUpRight :size="18" aria-hidden="true" /></a>
    <div v-if="tag" class="rd-filter-summary"><span>{{ tag }}</span><button type="button" aria-label="清除标签筛选" title="清除标签筛选" @click="tag = ''"><X :size="15" aria-hidden="true" /></button></div>
    <PageState v-if="loading" kind="loading" title="正在加载文章" />
    <PageState v-else-if="error" kind="error" title="暂时无法加载" :message="error"><button class="rd-button" type="button" @click="load"><RotateCw :size="16" aria-hidden="true" />重试</button></PageState>
    <PageState v-else-if="!filtered.length" :title="search || tag ? '没有找到匹配的文章' : '还没有文章'"><button v-if="search || tag" class="rd-button" type="button" @click="resetFilters">清除筛选</button><a v-else class="rd-button" href="/editor">发布第一篇文章</a></PageState>
    <template v-else><p v-if="!compact" class="rd-results" aria-live="polite">{{ filtered.length }} 篇文章</p><div class="rd-article-feed" :class="{ 'rd-article-grid': mode === 'grid' || compact }"><ArticleCard v-for="article in pageItems" :key="article.id" :article="article" :discussion="!compact" @tag="selectTag" /></div><nav v-if="!compact && filtered.length > pageSize" class="rd-pagination" aria-label="文章分页"><button class="rd-button" type="button" :disabled="page === 1" @click="page--"><ChevronLeft :size="16" aria-hidden="true" />上一页</button><span aria-live="polite">{{ page }} / {{ totalPages }}</span><button class="rd-button" type="button" :disabled="page === totalPages" @click="page++">下一页<ChevronRight :size="16" aria-hidden="true" /></button></nav></template>
    </div><aside v-if="!compact" class="article-community-sidebar" aria-label="社团与文章导航">
      <section class="article-community-invite"><p class="rd-eyebrow">FIND YOUR PEOPLE</p><h2>让热爱，有个落脚点。</h2><p>程序、美术、策划、技术美术与运营。<br>分享一段经验，也遇见下一位伙伴。</p><a href="/about/">认识 RD STUDIO <ArrowUpRight :size="18" /></a></section>
      <section><h2>继续探索</h2><a href="/kb/"><LibraryBig :size="19" /><span><strong>知识库</strong><small>沿着分支，积累创作经验</small></span><ArrowUpRight :size="17" /></a><a href="/tasks/"><ListChecks :size="19" /><span><strong>任务与签到</strong><small>让今天的进步，有迹可循</small></span><ArrowUpRight :size="17" /></a><a href="/user/profile?tab=favorites"><Bookmark :size="19" /><span><strong>我的收藏</strong><small>回到那些值得重读的文章</small></span><ArrowUpRight :size="17" /></a></section>
      <section v-if="!loading && !error && popularTags.length"><h2>大家的创作标签</h2><button v-for="topic in popularTags" :key="topic.name" type="button" class="article-community-topic" @click="selectTag(topic.name)"><span># {{ topic.name }}</span><small>{{ topic.count }} 篇</small></button></section>
    </aside></div>
  </section>
</template>
<script setup>
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ArrowUpRight, Bookmark, ChevronLeft, ChevronRight, LayoutGrid, LibraryBig, List, ListChecks, Plus, RotateCw, Search, Sparkles, X } from 'lucide-vue-next'
import PageState from './PageState.vue'
import ArticleCard from './ArticleCard.vue'
import { articleTopicTags } from '../lib/article-badges.mjs'
const props = defineProps({ compact: Boolean })
const articles = ref([]), loading = ref(true), error = ref(''), filter = ref('all'), search = ref(''), sort = ref('new'), mode = ref('list'), tag = ref(''), page = ref(1)
const pageSize = 12
const filters = [{ value: 'all', label: '全部' }, { value: 'public', label: '公开' }, { value: 'internal', label: '内部' }]
const popularTags = computed(() => { const counts=new Map();for(const article of articles.value)for(const name of new Set(articleTopicTags(article.tags)))counts.set(name,(counts.get(name)||0)+1);return [...counts].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count || a.name.localeCompare(b.name,'zh-CN')).slice(0,6) })
let requestId = 0, subscription
const filtered = computed(() => {
  const term = search.value.trim().toLowerCase()
  return articles.value.filter(a => (filter.value === 'all' || a.visibility === filter.value) && (!tag.value || a.tags?.includes(tag.value)) && (!term || [a.title, a.summary, ...(a.tags || [])].join(' ').toLowerCase().includes(term))).sort((a, b) => sort.value === 'popular' ? (b.likes_count || 0) - (a.likes_count || 0) : sort.value === 'discussed' ? (b.comments_count || 0) - (a.comments_count || 0) : String(b.created_at).localeCompare(String(a.created_at)))
})
const totalPages = computed(() => Math.max(1, Math.ceil(filtered.value.length / pageSize)))
const pageItems = computed(() => props.compact ? filtered.value.slice(0, 3) : filtered.value.slice((page.value - 1) * pageSize, page.value * pageSize))
watch([filter, search, sort, tag], () => { page.value = 1 })
function resetFilters() { search.value = ''; tag.value = ''; filter.value = 'all' }
function selectTag(value) { if (props.compact) window.location.assign('/articles?tag=' + encodeURIComponent(value)); else tag.value = value }
async function load() {
  const id = ++requestId
  loading.value = true; error.value = ''
  try {
    if (!window.__api) throw new Error('无法连接服务，请稍后重试')
    const collected = [], batchSize = props.compact ? 3 : 500
    do {
      let query = window.__api.from('articles').select('id,title,summary,cover_url,tags,visibility,status,kb_enabled,created_at,likes_count,comments_count,profiles!articles_author_id_fkey(username)').eq('status', 'published').order('created_at', { ascending: false }).limit(batchSize).offset(collected.length)
      if (props.compact) query = query.eq('visibility', 'public')
      const result = await query
      if (id !== requestId) return
      if (result.error) throw new Error(result.error.message)
      collected.push(...(result.data || []))
      if (props.compact || (result.data || []).length < batchSize) break
    } while (id === requestId)
    articles.value = collected; page.value = 1
  } catch (cause) { if (id === requestId) error.value = cause.message || '加载失败，请稍后重试' }
  finally { if (id === requestId) loading.value = false }
}
onMounted(() => {
  tag.value = new URLSearchParams(window.location.search).get('tag') || ''
  if (window.__api) subscription = window.__api.auth.onAuthStateChange(event => { if (event !== 'INITIAL_SESSION') load() }).data.subscription
  load()
})
onUnmounted(() => { ++requestId; subscription?.unsubscribe() })
</script>
