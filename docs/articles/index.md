---
title: 文章列表
layout: page
---

<div id="articles-page">
  <div class="page-header">
    <h1>📚 文章列表</h1>
    <div class="filter-bar">
      <button id="filter-all" class="filter-btn active" onclick="if(typeof document !== 'undefined') filterArticles('all')">全部</button>
      <button id="filter-public" class="filter-btn" onclick="if(typeof document !== 'undefined') filterArticles('public')">公开</button>
      <button id="filter-internal" class="filter-btn" onclick="if(typeof document !== 'undefined') filterArticles('internal')">内部</button>
    </div>
  </div>

  <div id="loading" class="loading">
    <p>加载中...</p>
    <p class="loading-hint">如果长时间没有响应，请检查浏览器控制台</p>
  </div>

  <div id="error" class="error" style="display:none">
    <p id="error-message">加载失败，请刷新页面重试</p>
  </div>

  <div id="no-articles" class="no-articles" style="display:none">
    <p>暂无文章</p>
    <p><a href="/SiteProject/editor" class="link">去发布第一篇文章</a></p>
  </div>

  <div id="articles-list" class="articles-list" style="display:none">
  </div>
</div>

<script>
var currentFilter = 'all'

function formatDate(d) { 
  const date = new Date(d)
  return date.toLocaleDateString('zh-CN', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  }) 
}

function getVisibilityText(v) {
  return { public: '🌐 公开', internal: '🔒 内部' }[v] || v
}

function getStatusText(s) {
  return { published: '✅ 已发布' }[s] || s
}

function getStatusBadgeClass(s) {
  return {
    published: 'badge-published'
  }[s] || 'badge-draft'
}

function renderArticlePreview(content) {
  if (!content) return ''
  const preview = content
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/https?:\/\/\S+\.(png|jpe?g|gif|webp)(\?\S*)?/gi, ' ')
    .replace(/[#>*_`~\[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 140)
  return preview + (content.length > 200 ? '...' : '')
}

function getArticleCover(article) {
  if (article.cover_url) return article.cover_url
  const match = String(article.content || '').match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+|data:image\/[^)]+)\)/i)
  return match ? match[1] : ''
}

function showError(message) {
  if (typeof document === 'undefined') return
  const loading = document.getElementById('loading')
  const error = document.getElementById('error')
  const errorMessage = document.getElementById('error-message')
  
  loading.style.display = 'none'
  error.style.display = 'block'
  errorMessage.textContent = message
  console.error('Articles page error:', message)
}

function showNoArticles() {
  if (typeof document === 'undefined') return
  const loading = document.getElementById('loading')
  const noArticles = document.getElementById('no-articles')
  
  loading.style.display = 'none'
  noArticles.style.display = 'block'
}

function showArticles(data) {
  if (typeof document === 'undefined') return
  const loading = document.getElementById('loading')
  const noArticles = document.getElementById('no-articles')
  const list = document.getElementById('articles-list')

  loading.style.display = 'none'
  noArticles.style.display = 'none'
  list.style.display = 'block'

  if (!data || data.length === 0) {
    showNoArticles()
    return
  }

  list.innerHTML = data.map(article => {
    const cover = getArticleCover(article)
    return `
    <div class="article-card">
      ${cover ? `<img src="${cover}" class="article-cover" alt="${article.title}" onerror="this.style.display='none'">` : ''}
      <div class="article-content">
        <div class="article-header">
          <h2><a href="/SiteProject/article?id=${article.id}">${article.title}</a></h2>
          <span class="badge ${getStatusBadgeClass(article.status)}">${getStatusText(article.status)}</span>
        </div>
        <p class="article-summary">${article.summary || renderArticlePreview(article.content)}</p>
        <div class="article-meta">
          <span class="meta-item">📅 ${formatDate(article.created_at)}</span>
          <span class="meta-item">${getVisibilityText(article.visibility)}</span>
          <span class="meta-item">❤️ ${article.likes_count || 0}</span>
          <span class="meta-item">💬 ${article.comments_count || 0}</span>
        </div>
        <div class="article-footer">
          ${article.tags && article.tags.length > 0 ? `
            <div class="article-tags">
              ${article.tags.map(tag => `<span class="tag">#${tag}</span>`).join('')}
            </div>
          ` : '<div></div>'}
          <a class="view-article-btn" href="/SiteProject/article?id=${article.id}">查看文章</a>
        </div>
          </div>
    </div>
  `}).join('')
}

async function waitForSupabase(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    if (typeof window !== 'undefined' && window.__supabase) {
      return true
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  return false
}

async function loadArticles() {
  if (typeof document === 'undefined') return
  const loading = document.getElementById('loading')
  loading.style.display = 'block'

  try {
    console.log('Waiting for Supabase...')
    const hasSupabase = await waitForSupabase()
    
    if (!hasSupabase) {
      showError('Supabase 未加载，请刷新页面重试')
      return
    }

    console.log('Supabase loaded, fetching articles...')
    const supabase = window.__supabase

    let query = supabase
      .from('articles')
      .select('id, title, summary, content, cover_url, tags, visibility, status, created_at, likes_count, comments_count')
      .eq('status', 'published')
      .order('created_at', { ascending: false })

    if (currentFilter !== 'all') {
      query = query.eq('visibility', currentFilter)
    }

    const { data, error } = await query

    if (error) {
      console.error('Database error:', error)
      showError('数据库错误: ' + error.message)
      return
    }

    console.log('Articles loaded:', data)
    showArticles(data)

  } catch (e) {
    console.error('Unexpected error:', e)
    showError('加载失败: ' + e.message)
  }
}

function filterArticles(filter) {
  if (typeof document === 'undefined') return
  currentFilter = filter
  
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'))
  document.getElementById('filter-' + filter).classList.add('active')
  
  loadArticles()
}

if (typeof window !== 'undefined') {
  window.filterArticles = filterArticles
  window.loadArticles = loadArticles
}

if (typeof document !== 'undefined') {
  setTimeout(() => {
    loadArticles()
  }, 100)
}
</script>

<style>
#articles-page {
  max-width: 1120px;
  margin: 0 auto;
  padding: 2rem;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 2rem;
}

.page-header h1 {
  margin: 0;
  font-size: 1.55rem;
}

.filter-bar {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter-btn {
  padding: 0.5rem 1rem;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.filter-btn:hover {
  background: var(--vp-c-divider);
}

.filter-btn.active {
  background: var(--vp-c-brand-1);
  color: white;
  border-color: var(--vp-c-brand-1);
}

.loading, .error, .no-articles {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--vp-c-text-2);
}

.loading-hint {
  font-size: 0.85rem;
  color: var(--vp-c-text-3);
  margin-top: 0.5rem;
}

.error p:first-child {
  color: #dc2626;
  font-weight: 500;
}

.link {
  color: var(--vp-c-brand-1);
  text-decoration: none;
}

.link:hover {
  text-decoration: underline;
}

.articles-list {
  display: grid;
  gap: 1rem;
}

.article-card {
  display: flex;
  gap: 1.25rem;
  padding: 1.15rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg);
  transition: all 0.2s;
  min-height: 180px;
}

.article-card:hover {
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.article-cover {
  width: 220px;
  height: 156px;
  object-fit: cover;
  border-radius: 8px;
  flex-shrink: 0;
}

.article-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.article-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.article-content h2 {
  margin: 0;
  flex: 1;
  min-width: 0;
  font-size: 1.25rem;
  line-height: 1.35;
}

.article-content h2 a {
  color: var(--vp-c-text-1);
  text-decoration: none;
  transition: color 0.2s;
  display: -webkit-box;
  overflow: hidden;
  overflow-wrap: anywhere;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.article-content h2 a:hover {
  color: var(--vp-c-brand-1);
}

.badge {
  flex-shrink: 0;
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
  font-weight: 500;
}

.badge-draft { background: #e5e7eb; color: #4b5563; }
.badge-pending { background: #fef3c7; color: #92400e; }
.badge-published { background: #d1fae5; color: #065f46; }
.badge-rejected { background: #fee2e2; color: #991b1b; }

.article-summary {
  margin: 0 0 1rem 0;
  color: var(--vp-c-text-2);
  line-height: 1.6;
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.article-meta {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
  font-size: 0.85rem;
  color: var(--vp-c-text-3);
}

.article-tags {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.article-footer {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  margin-top: auto;
}

.tag {
  padding: 0.25rem 0.5rem;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  border-radius: 4px;
  font-size: 0.8rem;
}

.view-article-btn {
  flex-shrink: 0;
  padding: 0.55rem 0.9rem;
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 8px;
  color: var(--vp-c-brand-1);
  text-decoration: none;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.view-article-btn:hover {
  background: var(--vp-c-brand-1);
  color: white;
}

@media (max-width: 768px) {
  .page-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .article-card {
    flex-direction: column;
  }

  .article-cover {
    width: 100%;
    height: 200px;
  }

  .article-footer {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
