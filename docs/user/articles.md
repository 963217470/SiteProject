---
title: 我的文章
layout: page
---

<script setup>
import { ref, computed, onMounted } from 'vue'

const loading = ref(true)
const notLoggedIn = ref(false)
const activeTab = ref('draft')
const articles = ref([])
let supabase = null

onMounted(async () => {
  try {
    if (!window.__supabase) { loading.value = false; return }
    supabase = window.__supabase
    const tabParam = new URLSearchParams(window.location.search).get('tab')
    if (tabParam) activeTab.value = tabParam
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { notLoggedIn.value = true; loading.value = false; return }
    const { data } = await supabase.from('articles').select('id, title, status, visibility, created_at, likes_count, comments_count, reject_reason').eq('author_id', session.user.id).order('created_at', { ascending: false })
    articles.value = data || []
  } catch (e) { console.error('My articles error:', e) }
  finally { loading.value = false }
})

const draftArticles = computed(() => articles.value.filter(a => a.status === 'draft'))
const pendingArticles = computed(() => articles.value.filter(a => a.status === 'pending'))
const publishedArticles = computed(() => articles.value.filter(a => a.status === 'published'))
const rejectedArticles = computed(() => articles.value.filter(a => a.status === 'rejected'))
function getStatusText(s) { return { draft: '📝 草稿', pending: '⏳ 待审核', published: '✅ 已发布', rejected: '❌ 退回' }[s] || s }
function formatDate(d) { return new Date(d).toLocaleDateString('zh-CN') }

async function deleteArticle(id) {
  if (!confirm('确定要删除这篇文章吗？')) return
  await supabase.from('articles').delete().eq('id', id)
  articles.value = articles.value.filter(a => a.id !== id)
}

async function resubmit(id) {
  await supabase.from('articles').update({ status: 'pending', reject_reason: null }).eq('id', id)
  const a = articles.value.find(a => a.id === id)
  if (a) { a.status = 'pending'; a.reject_reason = null }
}

async function withdrawArticle(id) {
  if (!confirm('确定要撤回这篇文章吗？')) return
  await supabase.from('articles').update({ status: 'draft' }).eq('id', id)
  const a = articles.value.find(a => a.id === id)
  if (a) a.status = 'draft'
}
</script>

<div class="my-articles-root">
<div v-show="notLoggedIn" class="not-logged-in"><p>请先 <a href="/SiteProject/login">登录</a></p></div>
<div v-show="loading && !notLoggedIn" class="loading-state"><p>加载中...</p></div>
<div v-show="!loading && !notLoggedIn" class="my-articles">
<div class="page-header">
<h1>📝 我的文章</h1>
<a href="/SiteProject/editor" class="btn-primary">+ 新建文章</a>
</div>
<div class="tabs">
<button :class="['tab', { active: activeTab === 'draft' }]" @click="activeTab = 'draft'">📄 草稿 ({{ draftArticles.length }})</button>
<button :class="['tab', { active: activeTab === 'pending' }]" @click="activeTab = 'pending'">⏳ 待审核 ({{ pendingArticles.length }})</button>
<button :class="['tab', { active: activeTab === 'published' }]" @click="activeTab = 'published'">✅ 已发布 ({{ publishedArticles.length }})</button>
<button :class="['tab', { active: activeTab === 'rejected' }]" @click="activeTab = 'rejected'">❌ 退回 ({{ rejectedArticles.length }})</button>
</div>
<div class="tab-content">
<div v-if="activeTab === 'draft'" class="article-list">
<div v-for="a in draftArticles" :key="a.id" class="article-item">
<div class="article-info">
<h3>{{ a.title }}</h3>
<div class="article-meta"><span>{{ formatDate(a.created_at) }}</span><span>{{ getStatusText(a.status) }}</span></div>
</div>
<div class="article-actions">
<a :href="'/SiteProject/editor?id=' + a.id" class="btn-edit">编辑</a>
<button class="btn-delete" @click="deleteArticle(a.id)">删除</button>
</div>
</div>
<div v-if="draftArticles.length === 0" class="no-articles"><p>暂无草稿</p></div>
</div>
<div v-if="activeTab === 'pending'" class="article-list">
<div v-for="a in pendingArticles" :key="a.id" class="article-item">
<div class="article-info">
<h3>{{ a.title }}</h3>
<div class="article-meta"><span>{{ formatDate(a.created_at) }}</span><span>{{ getStatusText(a.status) }}</span></div>
</div>
<div class="article-actions">
<button class="btn-resubmit" @click="withdrawArticle(a.id)">撤回</button>
</div>
</div>
<div v-if="pendingArticles.length === 0" class="no-articles"><p>暂无待审核文章</p></div>
</div>
<div v-if="activeTab === 'published'" class="article-list">
<div v-for="a in publishedArticles" :key="a.id" class="article-item">
<div class="article-info">
<h3><a :href="'/SiteProject/article?id=' + a.id">{{ a.title }}</a></h3>
<div class="article-meta">
<span>{{ formatDate(a.created_at) }}</span>
<span>❤️ {{ a.likes_count || 0 }}</span>
<span>💬 {{ a.comments_count || 0 }}</span>
</div>
</div>
<div class="article-actions">
<a :href="'/SiteProject/article?id=' + a.id" class="btn-view">查看</a>
<a :href="'/SiteProject/editor?id=' + a.id" class="btn-edit">编辑</a>
</div>
</div>
<div v-if="publishedArticles.length === 0" class="no-articles"><p>暂无已发布文章</p></div>
</div>
<div v-if="activeTab === 'rejected'" class="article-list">
<div v-for="a in rejectedArticles" :key="a.id" class="article-item">
<div class="article-info">
<h3>{{ a.title }}</h3>
<div class="article-meta"><span>{{ formatDate(a.created_at) }}</span><span class="rejected">{{ getStatusText(a.status) }}</span></div>
<div v-if="a.reject_reason" class="reject-reason">退回原因：{{ a.reject_reason }}</div>
</div>
<div class="article-actions">
<a :href="'/SiteProject/editor?id=' + a.id" class="btn-edit">编辑</a>
<button class="btn-resubmit" @click="resubmit(a.id)">重新提交</button>
<button class="btn-delete" @click="deleteArticle(a.id)">删除</button>
</div>
</div>
<div v-if="rejectedArticles.length === 0" class="no-articles"><p>暂无退回文章</p></div>
</div>
</div>
</div>
</div>

<style scoped>
.not-logged-in, .loading-state { text-align: center; padding: 4rem 2rem; color: var(--vp-c-text-2); }
.not-logged-in a { color: var(--vp-c-brand-1); }
.my-articles { max-width: 1000px; margin: 0 auto; padding: 2rem; }
.page-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 2rem; }
.page-header h1 { margin: 0; }
.btn-primary { display: inline-block; padding: 0.6rem 1.25rem; background: var(--vp-c-brand-1); color: white; border-radius: 8px; text-decoration: none; font-weight: 500; font-size: 0.875rem; }
.tabs { display: flex; gap: 0.5rem; border-bottom: 1px solid var(--vp-c-divider); margin-bottom: 1.5rem; }
.tab { padding: 0.75rem 1.25rem; background: none; border: none; border-bottom: 2px solid transparent; font-size: 0.95rem; cursor: pointer; color: var(--vp-c-text-2); transition: all 0.2s; }
.tab.active { border-bottom-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); font-weight: 500; }
.article-list { display: flex; flex-direction: column; gap: 1rem; }
.article-item { display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.5rem; border: 1px solid var(--vp-c-divider); border-radius: 8px; transition: border-color 0.2s; }
.article-item:hover { border-color: var(--vp-c-brand-1); }
.article-info h3 { margin: 0 0 0.4rem 0; font-size: 1.05rem; }
.article-info h3 a { color: var(--vp-c-brand-1); text-decoration: none; }
.article-meta { display: flex; gap: 1rem; font-size: 0.85rem; color: var(--vp-c-text-2); }
.rejected { color: #dc2626; }
.reject-reason { margin-top: 0.4rem; padding: 0.4rem 0.6rem; background: #fef3c7; border-radius: 4px; font-size: 0.85rem; color: #92400e; }
.article-actions { display: flex; gap: 0.5rem; flex-shrink: 0; }
.btn-view, .btn-edit, .btn-delete, .btn-resubmit { padding: 0.4rem 0.8rem; border: 1px solid var(--vp-c-divider); border-radius: 4px; background: var(--vp-c-bg); cursor: pointer; font-size: 0.8rem; text-decoration: none; transition: all 0.2s; }
.btn-view { color: var(--vp-c-brand-1); border-color: var(--vp-c-brand-1); }
.btn-edit { color: var(--vp-c-text-1); }
.btn-delete { color: #dc2626; border-color: #dc2626; }
.btn-resubmit { color: var(--vp-c-brand-1); border-color: var(--vp-c-brand-1); }
.no-articles { text-align: center; padding: 3rem; color: var(--vp-c-text-2); background: var(--vp-c-bg-soft); border-radius: 8px; }
.no-articles p { margin: 0; }
@media (max-width: 768px) { .article-item { flex-direction: column; align-items: flex-start; gap: 0.75rem; } }
</style>
