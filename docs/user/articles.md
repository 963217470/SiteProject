---
title: 我的文章
layout: page
---

<div id="my-articles-page">
  <div id="not-logged-in" class="not-logged-in" style="display:none">
    <p>请先 <a href="/SiteProject/login">登录</a></p>
  </div>

  <div id="loading" class="loading-state">
    <p>加载中...</p>
  </div>

  <div id="my-articles" class="my-articles" style="display:none">
    <div class="page-header">
      <h1>我的文章</h1>
      <a href="/SiteProject/editor" class="btn-primary">新建文章</a>
    </div>

    <div class="tabs">
      <button id="tab-draft" class="tab active" type="button" onclick="setActiveTab('draft')">草稿 (0)</button>
      <button id="tab-pending" class="tab" type="button" onclick="setActiveTab('pending')">待审核 (0)</button>
      <button id="tab-published" class="tab" type="button" onclick="setActiveTab('published')">已发布 (0)</button>
      <button id="tab-rejected" class="tab" type="button" onclick="setActiveTab('rejected')">退回 (0)</button>
    </div>

    <div id="article-list" class="article-list"></div>
  </div>
</div>

<script>
var myArticles = []
var activeTab = 'draft'
var supabaseClient = null

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString('zh-CN') : '未知时间'
}

function getStatusText(status) {
  return {
    draft: '草稿',
    pending: '待审核',
    published: '已发布',
    rejected: '退回'
  }[status] || status
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

function articlesByStatus(status) {
  return myArticles.filter(function(article) {
    return article.status === status
  })
}

function updateTabs() {
  var counts = {
    draft: articlesByStatus('draft').length,
    pending: articlesByStatus('pending').length,
    published: articlesByStatus('published').length,
    rejected: articlesByStatus('rejected').length
  }

  document.getElementById('tab-draft').textContent = '草稿 (' + counts.draft + ')'
  document.getElementById('tab-pending').textContent = '待审核 (' + counts.pending + ')'
  document.getElementById('tab-published').textContent = '已发布 (' + counts.published + ')'
  document.getElementById('tab-rejected').textContent = '退回 (' + counts.rejected + ')'
}

function setActiveTab(status) {
  activeTab = status
  Array.prototype.forEach.call(document.querySelectorAll('.tab'), function(tab) {
    tab.classList.remove('active')
  })
  var activeButton = document.getElementById('tab-' + status)
  if (activeButton) activeButton.classList.add('active')
  renderArticles()
}

function renderArticles() {
  updateTabs()

  var list = document.getElementById('article-list')
  var items = articlesByStatus(activeTab)

  if (!items.length) {
    list.innerHTML = '<div class="no-articles"><p>暂无' + getStatusText(activeTab) + '文章</p></div>'
    return
  }

  list.innerHTML = items.map(function(article) {
    var title = escapeHtml(article.title)
    var meta = '<div class="article-meta"><span>' + formatDate(article.created_at) + '</span><span>' + getStatusText(article.status) + '</span></div>'
    var actions = []

  if (article.status === 'draft') {
    actions.push('<a href="/SiteProject/editor?id=' + article.id + '" class="btn-edit">编辑</a>')
    actions.push("<button class=\"btn-delete\" type=\"button\" onclick=\"deleteArticle('" + article.id + "')\">删除</button>")
  }

  if (article.status === 'pending') {
    actions.push('<a href="/SiteProject/article?id=' + article.id + '" class="btn-view">查看</a>')
    actions.push("<button class=\"btn-resubmit\" type=\"button\" onclick=\"withdrawArticle('" + article.id + "')\">撤回</button>")
  }

    if (article.status === 'published') {
      actions.push('<a href="/SiteProject/article?id=' + article.id + '" class="btn-view">查看</a>')
      actions.push('<a href="/SiteProject/editor?id=' + article.id + '" class="btn-edit">编辑</a>')
    }

  if (article.status === 'rejected') {
    actions.push('<a href="/SiteProject/editor?id=' + article.id + '" class="btn-edit">编辑</a>')
    actions.push("<button class=\"btn-resubmit\" type=\"button\" onclick=\"resubmitArticle('" + article.id + "')\">重新提交</button>")
    actions.push("<button class=\"btn-delete\" type=\"button\" onclick=\"deleteArticle('" + article.id + "')\">删除</button>")
  }

    return [
      '<article class="article-item">',
      '  <div class="article-info">',
      '    <h3>' + title + '</h3>',
      meta,
      article.reject_reason ? '    <div class="reject-reason">退回原因：' + escapeHtml(article.reject_reason) + '</div>' : '',
      '  </div>',
      '  <div class="article-actions">' + actions.join('') + '</div>',
      '</article>'
    ].join('')
  }).join('')
}

async function loadArticles() {
  try {
    supabaseClient = await waitForSupabase()
    if (!supabaseClient) throw new Error('Supabase 未加载，请刷新页面后重试')

    var tabParam = new URLSearchParams(window.location.search).get('tab')
    if (tabParam) activeTab = tabParam

    var sessionResult = await supabaseClient.auth.getSession()
    var session = sessionResult.data && sessionResult.data.session
    if (!session) {
      setVisible('loading', false)
      setVisible('not-logged-in', true)
      return
    }

    var result = await supabaseClient
      .from('articles')
      .select('id, title, status, visibility, created_at, likes_count, comments_count, reject_reason')
      .eq('author_id', session.user.id)
      .order('created_at', { ascending: false })

    if (result.error) throw new Error(result.error.message)

    myArticles = result.data || []
    setVisible('loading', false)
    setVisible('my-articles', true)
    setActiveTab(activeTab)
  } catch (error) {
    setVisible('loading', false)
    document.getElementById('loading').innerHTML = '<p>加载失败：' + escapeHtml(error.message || '未知错误') + '</p>'
    setVisible('loading', true)
  }
}

async function deleteArticle(id) {
  if (!confirm('确定要删除这篇文章吗？')) return
  var result = await supabaseClient.from('articles').delete().eq('id', id)
  if (result.error) {
    alert('删除失败：' + result.error.message)
    return
  }
  myArticles = myArticles.filter(function(article) { return article.id !== id })
  renderArticles()
}

async function resubmitArticle(id) {
  var result = await supabaseClient
    .from('articles')
    .update({ status: 'pending', reject_reason: null, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (result.error) {
    alert('重新提交失败：' + result.error.message)
    return
  }

  var article = myArticles.find(function(item) { return item.id === id })
  if (article) {
    article.status = 'pending'
    article.reject_reason = null
  }
  setActiveTab('pending')
}

async function withdrawArticle(id) {
  if (!confirm('确定要撤回这篇文章吗？')) return
  var result = await supabaseClient
    .from('articles')
    .update({ status: 'draft', updated_at: new Date().toISOString() })
    .eq('id', id)

  if (result.error) {
    alert('撤回失败：' + result.error.message)
    return
  }

  var article = myArticles.find(function(item) { return item.id === id })
  if (article) article.status = 'draft'
  setActiveTab('draft')
}

if (typeof window !== 'undefined') {
  window.setActiveTab = setActiveTab
  window.deleteArticle = deleteArticle
  window.resubmitArticle = resubmitArticle
  window.withdrawArticle = withdrawArticle
}

if (typeof document !== 'undefined') {
  setTimeout(loadArticles, 100)
}
</script>

<style>
#my-articles-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem;
}

.not-logged-in,
.loading-state {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--vp-c-text-2);
}

.not-logged-in a {
  color: var(--vp-c-brand-1);
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
}

.page-header h1 {
  margin: 0;
}

.btn-primary {
  display: inline-block;
  padding: 0.6rem 1.25rem;
  background: var(--vp-c-brand-1);
  color: white;
  border-radius: 6px;
  text-decoration: none;
  font-weight: 500;
  font-size: 0.875rem;
}

.tabs {
  display: flex;
  gap: 0.5rem;
  border-bottom: 1px solid var(--vp-c-divider);
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.tab {
  padding: 0.75rem 1rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  font-size: 0.95rem;
  cursor: pointer;
  color: var(--vp-c-text-2);
}

.tab.active {
  border-bottom-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  font-weight: 600;
}

.article-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.article-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 1rem 1.25rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
}

.article-info h3 {
  margin: 0 0 0.4rem;
  font-size: 1.05rem;
}

.article-meta {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  font-size: 0.85rem;
  color: var(--vp-c-text-2);
}

.reject-reason {
  margin-top: 0.5rem;
  padding: 0.45rem 0.6rem;
  background: #fef3c7;
  border-radius: 4px;
  font-size: 0.85rem;
  color: #92400e;
}

.article-actions {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.btn-view,
.btn-edit,
.btn-delete,
.btn-resubmit {
  padding: 0.4rem 0.8rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px;
  background: var(--vp-c-bg);
  cursor: pointer;
  font-size: 0.8rem;
  text-decoration: none;
}

.btn-view,
.btn-resubmit {
  color: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
}

.btn-edit {
  color: var(--vp-c-text-1);
}

.btn-delete {
  color: #dc2626;
  border-color: #dc2626;
}

.no-articles {
  text-align: center;
  padding: 3rem;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-soft);
  border-radius: 8px;
}

.no-articles p {
  margin: 0;
}

@media (max-width: 768px) {
  #my-articles-page {
    padding: 1rem;
  }

  .page-header,
  .article-item {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
