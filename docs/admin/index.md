---
title: 文章审核
layout: page
---

<div id="admin-page">
  <div class="page-header">
    <h1>文章审核</h1>
    <div class="header-actions">
      <button class="btn-secondary" type="button" onclick="testConnection()">测试连接</button>
      <a href="/SiteProject/articles" class="btn-secondary">返回文章列表</a>
    </div>
  </div>

  <div id="loading" class="loading">
    <p>加载中...</p>
  </div>

  <div id="error" class="error" style="display:none">
    <p id="error-message">加载失败</p>
  </div>

  <div id="no-articles" class="no-articles" style="display:none">
    <p>暂无待处理文章</p>
  </div>

  <div id="articles-list" class="articles-list" style="display:none"></div>
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

function getStatusText(status) {
  return {
    draft: '草稿',
    pending: '待审核',
    published: '已发布',
    rejected: '已拒绝'
  }[status] || status
}

function getStatusBadgeClass(status) {
  return {
    draft: 'badge-draft',
    pending: 'badge-pending',
    published: 'badge-published',
    rejected: 'badge-rejected'
  }[status] || 'badge-draft'
}

function setVisible(id, visible) {
  var el = document.getElementById(id)
  if (el) el.style.display = visible ? 'block' : 'none'
}

function showError(message) {
  setVisible('loading', false)
  setVisible('articles-list', false)
  setVisible('no-articles', false)
  setVisible('error', true)
  var errorMessage = document.getElementById('error-message')
  if (errorMessage) errorMessage.textContent = message
  console.error('Admin page error:', message)
}

function showNoArticles() {
  setVisible('loading', false)
  setVisible('error', false)
  setVisible('articles-list', false)
  setVisible('no-articles', true)
}

function renderArticles(articles) {
  var list = document.getElementById('articles-list')
  if (!list) return

  setVisible('loading', false)
  setVisible('error', false)
  setVisible('no-articles', false)

  if (!articles || articles.length === 0) {
    showNoArticles()
    return
  }

  list.style.display = 'grid'
  list.innerHTML = articles.map(function(article) {
    var title = escapeHtml(article.title)
    var summary = escapeHtml(article.summary)
    var reason = escapeHtml(article.reject_reason)
    var status = escapeHtml(getStatusText(article.status))
    var badgeClass = getStatusBadgeClass(article.status)

    return [
      '<article class="article-card">',
      '  <div class="article-header">',
      '    <h2>' + title + '</h2>',
      '    <span class="badge ' + badgeClass + '">' + status + '</span>',
      '  </div>',
      '  <div class="article-meta">',
      '    <span>' + formatDate(article.created_at) + '</span>',
      article.visibility ? '    <span>' + escapeHtml(article.visibility) + '</span>' : '',
      '  </div>',
      summary ? '  <p class="article-summary">' + summary + '</p>' : '',
      reason ? '  <p class="reject-reason">拒绝原因：' + reason + '</p>' : '',
      '  <div class="article-actions">',
      article.status === 'pending' ? '    <button class="btn-success" type="button" onclick="publishArticle(\'' + article.id + '\')">通过</button>' : '',
      article.status === 'pending' ? '    <button class="btn-danger" type="button" onclick="showRejectModal(\'' + article.id + '\')">拒绝</button>' : '',
      article.status === 'published' ? '    <button class="btn-warning" type="button" onclick="unpublishArticle(\'' + article.id + '\')">撤回发布</button>' : '',
      article.status === 'draft' || article.status === 'rejected' ? '    <button class="btn-success" type="button" onclick="publishArticle(\'' + article.id + '\')">直接发布</button>' : '',
      '    <button class="btn-secondary" type="button" onclick="viewArticle(\'' + article.id + '\')">查看</button>',
      '    <button class="btn-danger" type="button" onclick="deleteArticle(\'' + article.id + '\')">删除</button>',
      '  </div>',
      '</article>'
    ].join('')
  }).join('')
}

async function waitForSupabase(maxAttempts) {
  maxAttempts = maxAttempts || 30
  for (var i = 0; i < maxAttempts; i++) {
    if (typeof window !== 'undefined' && window.__supabase) return window.__supabase
    await new Promise(function(resolve) { setTimeout(resolve, 100) })
  }
  return null
}

async function loadArticles() {
  setVisible('loading', true)
  setVisible('error', false)
  setVisible('no-articles', false)
  setVisible('articles-list', false)

  try {
    var supabase = await waitForSupabase()
    if (!supabase) {
      showError('Supabase 未加载，请刷新页面后重试')
      return
    }

    var result = await supabase
      .from('articles')
      .select('id, title, summary, status, visibility, created_at, updated_at, published_at, reject_reason')
      .order('created_at', { ascending: false })

    if (result.error) {
      showError('数据库查询失败：' + result.error.message)
      return
    }

    renderArticles(result.data || [])
  } catch (error) {
    showError('加载失败：' + (error.message || '未知错误'))
  }
}

async function updateArticleStatus(id, status, rejectReason) {
  try {
    var supabase = await waitForSupabase()
    if (!supabase) {
      alert('Supabase 未加载，请刷新页面后重试')
      return false
    }

    var updateData = {
      status: status,
      updated_at: new Date().toISOString()
    }

    if (status === 'published') {
      updateData.published_at = new Date().toISOString()
      updateData.reject_reason = null
    }

    if (status === 'pending') {
      updateData.reject_reason = null
    }

    if (status === 'rejected') {
      updateData.reject_reason = rejectReason || ''
    }

    var result = await supabase
      .from('articles')
      .update(updateData)
      .eq('id', id)

    if (result.error) {
      alert('操作失败：' + result.error.message)
      return false
    }

    return true
  } catch (error) {
    alert('操作失败：' + (error.message || '未知错误'))
    return false
  }
}

async function publishArticle(id) {
  if (!confirm('确定通过并发布这篇文章吗？')) return
  if (await updateArticleStatus(id, 'published')) {
    alert('已发布')
    loadArticles()
  }
}

async function unpublishArticle(id) {
  if (!confirm('确定撤回发布，让文章回到待审核吗？')) return
  if (await updateArticleStatus(id, 'pending')) {
    alert('已撤回发布')
    loadArticles()
  }
}

function showRejectModal(id) {
  var reason = prompt('请输入拒绝原因（可选）')
  if (reason !== null) rejectArticle(id, reason)
}

async function rejectArticle(id, reason) {
  if (await updateArticleStatus(id, 'rejected', reason || '')) {
    alert('已拒绝')
    loadArticles()
  }
}

async function deleteArticle(id) {
  if (!confirm('确定删除这篇文章吗？此操作不可恢复。')) return

  try {
    var supabase = await waitForSupabase()
    if (!supabase) {
      alert('Supabase 未加载，请刷新页面后重试')
      return
    }

    var result = await supabase
      .from('articles')
      .delete()
      .eq('id', id)

    if (result.error) {
      alert('删除失败：' + result.error.message)
      return
    }

    alert('已删除')
    loadArticles()
  } catch (error) {
    alert('删除失败：' + (error.message || '未知错误'))
  }
}

function viewArticle(id) {
  window.open('/SiteProject/article?id=' + encodeURIComponent(id), '_blank')
}

async function testConnection() {
  var supabase = await waitForSupabase()
  if (!supabase) {
    alert('Supabase 未加载，请刷新页面后重试')
    return
  }

  var result = await supabase
    .from('articles')
    .select('id, title, status')
    .limit(5)

  if (result.error) {
    alert('连接失败：' + result.error.message)
    return
  }

  alert('连接正常，当前可读取 ' + (result.data || []).length + ' 篇文章')
}

if (typeof window !== 'undefined') {
  window.loadArticles = loadArticles
  window.publishArticle = publishArticle
  window.unpublishArticle = unpublishArticle
  window.showRejectModal = showRejectModal
  window.rejectArticle = rejectArticle
  window.deleteArticle = deleteArticle
  window.viewArticle = viewArticle
  window.testConnection = testConnection
}

if (typeof document !== 'undefined') {
  setTimeout(loadArticles, 100)
}
</script>

<style>
#admin-page {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem;
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

.header-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.loading,
.error,
.no-articles {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--vp-c-text-2);
}

.error p:first-child {
  color: #dc2626;
  font-weight: 600;
}

.articles-list {
  display: grid;
  gap: 1rem;
}

.article-card {
  padding: 1.25rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
}

.article-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 0.75rem;
}

.article-header h2 {
  margin: 0;
  font-size: 1.2rem;
}

.article-meta {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
  color: var(--vp-c-text-3);
  font-size: 0.9rem;
}

.article-summary {
  margin: 0 0 1rem;
  color: var(--vp-c-text-2);
  line-height: 1.6;
}

.reject-reason {
  margin: 0 0 1rem;
  padding: 0.75rem;
  border-radius: 6px;
  background: #fef3c7;
  color: #92400e;
}

.article-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn-secondary,
.btn-success,
.btn-danger,
.btn-warning {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0.45rem 0.85rem;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.875rem;
  text-decoration: none;
}

.btn-secondary {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  border-color: var(--vp-c-divider);
}

.btn-success {
  background: #059669;
  color: white;
}

.btn-danger {
  background: #dc2626;
  color: white;
}

.btn-warning {
  background: #f59e0b;
  color: white;
}

.badge {
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  font-size: 0.8rem;
  white-space: nowrap;
}

.badge-draft {
  background: #e5e7eb;
  color: #4b5563;
}

.badge-pending {
  background: #fef3c7;
  color: #92400e;
}

.badge-published {
  background: #d1fae5;
  color: #065f46;
}

.badge-rejected {
  background: #fee2e2;
  color: #991b1b;
}

@media (max-width: 768px) {
  #admin-page {
    padding: 1rem;
  }

  .page-header,
  .article-header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
