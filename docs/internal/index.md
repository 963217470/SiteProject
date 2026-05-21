---
title: 内部文章
layout: page
---

<script setup>
import { ref, computed, onMounted } from 'vue'

const loading = ref(true)
const notMember = ref(false)
const articles = ref([])
const selectedTags = ref([])
const sortOrder = ref('newest')
let supabase = null

const availableTags = ['Unity', 'Godot', 'Unreal Engine', 'Cocos Creator', 'C#', 'GDScript', 'C++', 'Lua', '教程', '入门', '进阶', '会议记录']

onMounted(async () => {
  try {
    if (!window.__supabase) { loading.value = false; return }
    supabase = window.__supabase
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { notMember.value = true; loading.value = false; return }
    const { data } = await supabase.from('articles').select('id, title, summary, cover_url, tags, created_at, profiles!articles_author_id_fkey(username)').eq('status', 'published').eq('visibility', 'internal').order('created_at', { ascending: false })
    articles.value = data || []
  } catch (e) { console.error('Internal articles error:', e) }
  finally { loading.value = false }
})

const filteredArticles = computed(() => {
  let result = [...articles.value]
  if (selectedTags.value.length > 0) result = result.filter(a => a.tags && a.tags.some(t => selectedTags.value.includes(t)))
  if (sortOrder.value === 'newest') result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  return result
})

function toggleTag(tag) {
  const i = selectedTags.value.indexOf(tag)
  if (i === -1) selectedTags.value.push(tag)
  else selectedTags.value.splice(i, 1)
}

function formatDate(d) { return new Date(d).toLocaleDateString('zh-CN') }
</script>

<div class="internal-page">
<h1>🔒 内部文章</h1>
<div v-show="loading" class="loading-state"><p>加载中...</p></div>
<div v-show="notMember && !loading" class="not-member"><p>请先 <a href="/SiteProject/login">登录</a> 以查看内部文章</p></div>
<div v-show="!loading && !notMember">
<div class="internal-notice"><p>⚠️ 此区域仅社员可见，请勿外传</p></div>
<div class="filter-section">
<div class="tag-filter">
<span>标签筛选：</span>
<button v-for="tag in availableTags" :key="tag" :class="['tag', { active: selectedTags.includes(tag) }]" @click="toggleTag(tag)">{{ tag }}</button>
</div>
<div class="sort-filter">
<span>排序：</span>
<select v-model="sortOrder" class="sort-select"><option value="newest">最新</option></select>
</div>
</div>
<div class="article-list">
<a v-for="a in filteredArticles" :key="a.id" :href="'/SiteProject/article?id=' + a.id" class="article-card">
<div v-if="a.cover_url" class="article-cover"><img :src="a.cover_url" :alt="a.title"></div>
<div class="article-info">
<h3>🔒 {{ a.title }}</h3>
<p v-if="a.summary" class="article-summary">{{ a.summary }}</p>
<div class="article-meta">
<span class="author">{{ a.profiles?.username || '未知' }}</span>
<span>{{ formatDate(a.created_at) }}</span>
</div>
<div v-if="a.tags && a.tags.length > 0" class="article-tags">
<span v-for="t in a.tags" :key="t" class="tag-item">{{ t }}</span>
</div>
</div>
</a>
</div>
<div v-if="!loading && filteredArticles.length === 0" class="no-articles"><p>暂无内部文章</p></div>
</div>
</div>

<style scoped>
.internal-page { max-width: 900px; margin: 0 auto; padding: 2rem; }
.internal-page h1 { margin: 0 0 1.5rem 0; }
.loading-state, .not-member { text-align: center; padding: 3rem; color: var(--vp-c-text-2); }
.not-member a { color: var(--vp-c-brand-1); }
.internal-notice { padding: 0.75rem 1rem; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; margin-bottom: 1.5rem; color: #92400e; font-size: 0.9rem; }
.internal-notice p { margin: 0; }
.filter-section { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 2rem; padding: 1rem; background: var(--vp-c-bg-soft); border-radius: 8px; }
.tag-filter { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
.tag-filter span { font-weight: 500; font-size: 0.875rem; }
.tag { display: inline-block; padding: 0.2rem 0.6rem; font-size: 0.8rem; border-radius: 16px; background: var(--vp-c-bg); border: 1px solid var(--vp-c-divider); cursor: pointer; transition: all 0.2s; }
.tag:hover { border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); }
.tag.active { background: var(--vp-c-brand-1); color: white; border-color: var(--vp-c-brand-1); }
.sort-filter { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; }
.sort-select { padding: 0.4rem 0.75rem; border: 1px solid var(--vp-c-divider); border-radius: 4px; background: var(--vp-c-bg); font-size: 0.875rem; }
.article-list { display: flex; flex-direction: column; gap: 1rem; }
.article-card { display: flex; gap: 1.25rem; border: 1px solid var(--vp-c-divider); border-radius: 8px; padding: 1.25rem; text-decoration: none; color: inherit; transition: all 0.2s; }
.article-card:hover { border-color: var(--vp-c-brand-1); box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06); }
.article-cover { flex-shrink: 0; width: 180px; height: 110px; border-radius: 6px; overflow: hidden; }
.article-cover img { width: 100%; height: 100%; object-fit: cover; }
.article-info { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.article-info h3 { margin: 0 0 0.4rem 0; font-size: 1.15rem; color: var(--vp-c-text-1); }
.article-summary { margin: 0 0 0.5rem 0; font-size: 0.85rem; color: var(--vp-c-text-2); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.article-meta { display: flex; gap: 1rem; font-size: 0.8rem; color: var(--vp-c-text-2); margin-bottom: 0.5rem; }
.author { font-weight: 500; color: var(--vp-c-text-1); }
.article-tags { display: flex; gap: 0.4rem; margin-top: auto; flex-wrap: wrap; }
.tag-item { padding: 0.15rem 0.5rem; background: var(--vp-c-bg-soft); border-radius: 4px; font-size: 0.75rem; color: var(--vp-c-text-2); }
.no-articles { text-align: center; padding: 3rem; color: var(--vp-c-text-2); background: var(--vp-c-bg-soft); border-radius: 8px; }
.no-articles p { margin: 0; }
@media (max-width: 768px) { .article-card { flex-direction: column; } .article-cover { width: 100%; height: 160px; } }
</style>
