---
title: 文章详情
layout: page
---

<div id="article-page">
  <div id="loading" class="loading">
    <p>加载中...</p>
  </div>

  <div id="error" class="error" style="display:none">
    <p id="error-message">加载失败</p>
    <p><a href="/SiteProject/articles">返回文章列表</a></p>
  </div>

  <div id="article-not-found" class="not-found" style="display:none">
    <p>文章不存在</p>
    <p><a href="/SiteProject/articles">返回文章列表</a></p>
  </div>

  <article id="article-content" style="display:none"></article>
</div>

<script>
function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatDate(value) {
  if (!value) return '未知时间'
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function getVisibilityText(value) {
  return { public: '公开', internal: '内部' }[value] || value
}

function getStatusText(value) {
  return {
    draft: '草稿',
    pending: '待审核',
    published: '已发布',
    rejected: '已拒绝'
  }[value] || value
}

function renderMarkdown(content) {
  var html = escapeHtml(content)
    .replace(/^### (.*)$/gim, '<h3>$1</h3>')
    .replace(/^## (.*)$/gim, '<h2>$1</h2>')
    .replace(/^# (.*)$/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br>')

  return '<p>' + html + '</p>'
}

function setVisible(id, visible) {
  var el = document.getElementById(id)
  if (el) el.style.display = visible ? 'block' : 'none'
}

async function waitForSupabase(maxAttempts) {
  maxAttempts = maxAttempts || 30
  for (var i = 0; i < maxAttempts; i++) {
    if (typeof window !== 'undefined' && window.__supabase) return window.__supabase
    await new Promise(function(resolve) { setTimeout(resolve, 100) })
  }
  return null
}

async function loadArticle() {
  setVisible('loading', true)
  setVisible('error', false)
  setVisible('article-not-found', false)
  setVisible('article-content', false)

  try {
    var articleId = new URLSearchParams(window.location.search).get('id')
    if (!articleId) {
      setVisible('loading', false)
      setVisible('article-not-found', true)
      return
    }

    var supabase = await waitForSupabase()
    if (!supabase) throw new Error('Supabase 未加载，请刷新页面后重试')

    var result = await supabase
      .from('articles')
      .select('id, title, summary, content, cover_url, tags, visibility, status, created_at, likes_count, comments_count')
      .eq('id', articleId)
      .single()

    if (result.error) throw new Error(result.error.message)
    if (!result.data) {
      setVisible('loading', false)
      setVisible('article-not-found', true)
      return
    }

    var article = result.data
    var content = document.getElementById('article-content')
    document.title = article.title + ' | RD STUDIO'

    content.innerHTML = [
      '<a href="/SiteProject/articles" class="back-link">返回文章列表</a>',
      article.cover_url ? '<img src="' + escapeHtml(article.cover_url) + '" class="article-cover" alt="' + escapeHtml(article.title) + '">' : '',
      '<header class="article-header">',
      '  <h1>' + escapeHtml(article.title) + '</h1>',
      '  <div class="article-meta">',
      '    <span>' + formatDate(article.created_at) + '</span>',
      '    <span>' + escapeHtml(getVisibilityText(article.visibility)) + '</span>',
      '    <span>' + escapeHtml(getStatusText(article.status)) + '</span>',
      '    <span>喜欢 ' + (article.likes_count || 0) + '</span>',
      '    <span>评论 ' + (article.comments_count || 0) + '</span>',
      '  </div>',
      article.tags && article.tags.length ? '  <div class="article-tags">' + article.tags.map(function(tag) { return '<span class="tag">#' + escapeHtml(tag) + '</span>' }).join('') + '</div>' : '',
      '</header>',
      article.summary ? '<div class="article-summary">' + escapeHtml(article.summary) + '</div>' : '',
      '<div class="article-body">' + renderMarkdown(article.content || '') + '</div>'
    ].join('')

    setVisible('loading', false)
    content.style.display = 'block'
  } catch (error) {
    setVisible('loading', false)
    setVisible('error', true)
    document.getElementById('error-message').textContent = '加载失败：' + (error.message || '未知错误')
  }
}

if (typeof document !== 'undefined') {
  setTimeout(loadArticle, 100)
}
</script>

<style>
#article-page {
  max-width: 820px;
  margin: 0 auto;
  padding: 2rem;
}

.loading,
.error,
.not-found {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--vp-c-text-2);
}

.error p:first-child {
  color: #dc2626;
  font-weight: 600;
}

.back-link {
  display: inline-block;
  margin-bottom: 1.5rem;
  color: var(--vp-c-brand-1);
  text-decoration: none;
}

.article-cover {
  width: 100%;
  max-height: 420px;
  object-fit: cover;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.article-header h1 {
  margin: 0 0 1rem;
  font-size: 2rem;
}

.article-meta {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  color: var(--vp-c-text-3);
  font-size: 0.9rem;
}

.article-tags {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-top: 1rem;
}

.tag {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}

.article-summary {
  margin: 2rem 0;
  padding: 1rem 1.25rem;
  border-left: 4px solid var(--vp-c-brand-1);
  border-radius: 0 6px 6px 0;
  background: var(--vp-c-bg-soft);
  line-height: 1.7;
}

.article-body {
  line-height: 1.8;
}

.article-body h1,
.article-body h2,
.article-body h3 {
  margin: 1.5rem 0 0.75rem;
}

.article-body code {
  padding: 0.15rem 0.35rem;
  border-radius: 4px;
  background: var(--vp-c-bg-soft);
}

@media (max-width: 768px) {
  #article-page {
    padding: 1rem;
  }

  .article-header h1 {
    font-size: 1.5rem;
  }
}
</style>
