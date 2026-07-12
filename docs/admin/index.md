---
title: 文章审核
layout: page
---

<div id="admin-page">
  <div class="page-header">
    <div>
      <p class="eyebrow">管理后台</p>
      <h1>文章审核</h1>
    </div>
    <div class="header-actions">
      <button class="btn-secondary" type="button" onclick="testConnection()">测试连接</button>
      <a href="/articles" class="btn-secondary">返回文章列表</a>
    </div>
  </div>

  <nav class="admin-section-nav" aria-label="审核类型">
    <a class="active" href="/admin">文章审核</a>
    <a href="/admin/profile-review">个人信息审核</a>
    <a href="/admin/kb">知识库管理</a>
  </nav>

  <section class="review-summary" aria-label="审核统计">
    <div class="summary-card urgent">
      <strong id="stat-pending">0</strong>
      <span>待审核</span>
    </div>
    <div class="summary-card">
      <strong id="stat-published">0</strong>
      <span>已发布</span>
    </div>
    <div class="summary-card">
      <strong id="stat-rejected">0</strong>
      <span>已拒绝</span>
    </div>
    <div class="summary-card">
      <strong id="stat-total">0</strong>
      <span>全部文章</span>
    </div>
  </section>

  <div class="review-toolbar">
    <div class="filter-bar" aria-label="审核筛选">
      <button id="filter-pending" class="filter-btn active" type="button" onclick="filterAdminArticles('pending')">待审核</button>
      <button id="filter-published" class="filter-btn" type="button" onclick="filterAdminArticles('published')">已发布</button>
      <button id="filter-rejected" class="filter-btn" type="button" onclick="filterAdminArticles('rejected')">已拒绝</button>
      <button id="filter-all" class="filter-btn" type="button" onclick="filterAdminArticles('all')">全部</button>
    </div>
    <p id="review-hint" class="review-hint">优先处理待审核文章；通过后才会出现在文章列表。</p>
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
var adminState = { filter: 'pending', articles: [], busyId: '' }

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

function getVisibilityText(value) {
  return { public: '公开', internal: '内部' }[value] || value || '公开'
}

function countStatus(status) {
  return adminState.articles.filter(function(article) { return article.status === status }).length
}

function updateStats() {
  var pending = document.getElementById('stat-pending')
  var published = document.getElementById('stat-published')
  var rejected = document.getElementById('stat-rejected')
  var total = document.getElementById('stat-total')
  if (pending) pending.textContent = countStatus('pending')
  if (published) published.textContent = countStatus('published')
  if (rejected) rejected.textContent = countStatus('rejected')
  if (total) total.textContent = adminState.articles.length
}

function getFilteredArticles() {
  if (adminState.filter === 'all') return adminState.articles
  return adminState.articles.filter(function(article) { return article.status === adminState.filter })
}

function setActionBusy(id, busy) {
  adminState.busyId = busy ? id : ''
  Array.prototype.forEach.call(document.querySelectorAll('.article-actions button'), function(button) {
    button.disabled = !!busy
  })
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
  var panel = document.getElementById('no-articles')
  if (panel) {
    panel.innerHTML = '<p>' + ({
      pending: '暂无待审核文章',
      published: '暂无已发布文章',
      rejected: '暂无已拒绝文章',
      all: '暂无文章'
    }[adminState.filter] || '暂无文章') + '</p>'
  }
}

function renderArticles(articles) {
  var list = document.getElementById('articles-list')
  if (!list) return

  setVisible('loading', false)
  setVisible('error', false)
  setVisible('no-articles', false)

  updateStats()

  var filteredArticles = getFilteredArticles()
  var hint = document.getElementById('review-hint')
  if (hint) {
    hint.textContent = adminState.filter === 'pending'
      ? '优先处理待审核文章；通过后才会出现在文章列表。'
      : '当前显示：' + ({ published: '已发布文章', rejected: '已拒绝文章', all: '全部文章' }[adminState.filter] || '文章')
  }

  if (!filteredArticles || filteredArticles.length === 0) {
    showNoArticles()
    return
  }

  list.style.display = 'grid'
  list.innerHTML = filteredArticles.map(function(article) {
    var title = escapeHtml(article.title)
    var summary = escapeHtml(article.summary)
    var reason = escapeHtml(article.reject_reason)
    var status = escapeHtml(getStatusText(article.status))
    var badgeClass = getStatusBadgeClass(article.status)
    var visibility = escapeHtml(getVisibilityText(article.visibility))
    var updatedAt = article.updated_at ? formatDate(article.updated_at) : ''
    var isBusy = adminState.busyId === article.id

    return [
      '<article class="article-card">',
      '  <div class="article-main">',
      '    <div class="article-header">',
      '      <div>',
      '        <h2>' + title + '</h2>',
      '        <div class="article-meta">',
      '          <span>提交：' + formatDate(article.created_at) + '</span>',
      updatedAt ? '          <span>更新：' + updatedAt + '</span>' : '',
      '          <span>' + visibility + '</span>',
      '        </div>',
      '      </div>',
      '      <span class="badge ' + badgeClass + '">' + status + '</span>',
      '    </div>',
      summary ? '    <p class="article-summary">' + summary + '</p>' : '    <p class="article-summary muted">暂无摘要</p>',
      reason ? '    <p class="reject-reason">拒绝原因：' + reason + '</p>' : '',
      '  </div>',
      '  <div class="article-actions">',
      article.status === 'pending' ? '    <button class="btn-success" type="button" onclick="publishArticle(\'' + article.id + '\')" ' + (isBusy ? 'disabled' : '') + '>通过</button>' : '',
      article.status === 'pending' ? '    <button class="btn-danger" type="button" onclick="showRejectModal(\'' + article.id + '\')" ' + (isBusy ? 'disabled' : '') + '>拒绝</button>' : '',
      article.status === 'published' ? '    <button class="btn-warning" type="button" onclick="unpublishArticle(\'' + article.id + '\')" ' + (isBusy ? 'disabled' : '') + '>撤回</button>' : '',
      article.status === 'draft' || article.status === 'rejected' ? '    <button class="btn-success" type="button" onclick="publishArticle(\'' + article.id + '\')" ' + (isBusy ? 'disabled' : '') + '>直接发布</button>' : '',
      '    <button class="btn-secondary" type="button" onclick="viewArticle(\'' + article.id + '\')">查看</button>',
      '    <button class="btn-danger ghost-danger" type="button" onclick="deleteArticle(\'' + article.id + '\')" ' + (isBusy ? 'disabled' : '') + '>删除</button>',
      '  </div>',
      '</article>'
    ].join('')
  }).join('')
}

function filterAdminArticles(filter) {
  adminState.filter = filter
  Array.prototype.forEach.call(document.querySelectorAll('.filter-btn'), function(button) { button.classList.remove('active') })
  var active = document.getElementById('filter-' + filter)
  if (active) active.classList.add('active')
  renderArticles(adminState.articles)
}

async function waitForSupabase(maxAttempts) {
  maxAttempts = maxAttempts || 30
  for (var i = 0; i < maxAttempts; i++) {
    if (typeof window !== 'undefined' && window.getSupabaseClient?.()) return window.getSupabaseClient?.()
    await new Promise(function(resolve) { setTimeout(resolve, 100) })
  }
  return null
}

async function requireAdmin(supabase) {
  var sessionResult = await supabase.auth.getSession()
  var user = sessionResult && sessionResult.data && sessionResult.data.session && sessionResult.data.session.user

  if (!user || !user.id) {
    showError('请先登录管理员账号')
    return false
  }

  var profileResult = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileResult.error) {
    showError('读取用户权限失败：' + profileResult.error.message)
    return false
  }

  if (!profileResult.data || !window.RDPermissions?.derivePermissions(profileResult.data.role).isAdmin) {
    showError('当前账号没有管理员权限')
    return false
  }

  return true
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

    if (!await requireAdmin(supabase)) return

    var result = await supabase
      .from('articles')
      .select('id, title, summary, status, visibility, created_at, updated_at, published_at, reject_reason')
      .order('created_at', { ascending: false })

    if (result.error) {
      showError('数据库查询失败：' + result.error.message)
      return
    }

    adminState.articles = result.data || []
    renderArticles(adminState.articles)
  } catch (error) {
    showError('加载失败：' + (error.message || '未知错误'))
  }
}

async function updateArticleStatus(id, status, rejectReason) {
  try {
    setActionBusy(id, true)
    var supabase = await waitForSupabase()
    if (!supabase) {
      alert('Supabase 未加载，请刷新页面后重试')
      return false
    }

    if (!await requireAdmin(supabase)) return false

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
      .select('id')

    if (result.error) {
      alert('操作失败：' + result.error.message)
      return false
    }

    if (!result.data || result.data.length === 0) {
      alert('操作失败：数据库没有更新任何文章，请确认当前账号有管理员权限')
      return false
    }

    return true
  } catch (error) {
    alert('操作失败：' + (error.message || '未知错误'))
    return false
  } finally {
    setActionBusy(id, false)
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

    if (!await requireAdmin(supabase)) return

    var result = await supabase
      .from('articles')
      .delete()
      .eq('id', id)
      .select('id')

    if (result.error) {
      alert('删除失败：' + result.error.message)
      return
    }

    if (!result.data || result.data.length === 0) {
      alert('删除失败：数据库没有删除任何文章，请确认当前账号有管理员权限')
      return
    }

    alert('已删除')
    loadArticles()
  } catch (error) {
    alert('删除失败：' + (error.message || '未知错误'))
  }
}

function viewArticle(id) {
  window.open('/article?id=' + encodeURIComponent(id), '_blank')
}

async function testConnection() {
  var supabase = await waitForSupabase()
  if (!supabase) {
    alert('Supabase 未加载，请刷新页面后重试')
    return
  }

  if (!await requireAdmin(supabase)) return

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
  window.filterAdminArticles = filterAdminArticles
}

if (typeof document !== 'undefined') {
  setTimeout(loadArticles, 100)
}
</script>

<style>
#admin-page {
  max-width: 1120px;
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

.eyebrow {
  margin: 0 0 0.35rem;
  color: var(--vp-c-brand-1);
  font-size: 0.82rem;
  font-weight: 700;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.admin-section-nav {
  display: flex;
  gap: 0.5rem;
  margin: -0.75rem 0 1.25rem;
  padding: 0.35rem;
  width: fit-content;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
}

.admin-section-nav a {
  padding: 0.45rem 0.8rem;
  border-radius: 6px;
  color: var(--vp-c-text-2);
  text-decoration: none;
  font-size: 0.9rem;
}

.admin-section-nav a.active {
  background: var(--vp-c-bg);
  color: var(--vp-c-brand-1);
  font-weight: 700;
}

.review-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.85rem;
  margin-bottom: 1rem;
}

.summary-card {
  display: grid;
  gap: 0.25rem;
  padding: 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
}

.summary-card.urgent {
  border-color: rgba(245, 158, 11, 0.45);
  background: rgba(245, 158, 11, 0.09);
}

.summary-card strong {
  font-size: 1.35rem;
  line-height: 1;
}

.summary-card span {
  color: var(--vp-c-text-2);
  font-size: 0.86rem;
}

.review-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
  padding: 0.85rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
}

.filter-bar {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.filter-btn {
  min-height: 34px;
  padding: 0 0.8rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  cursor: pointer;
}

.filter-btn.active {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-1);
  color: #fff;
}

.review-hint {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 0.86rem;
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
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 1.25rem;
  align-items: start;
  padding: 1.2rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
}

.article-card:hover {
  border-color: rgba(100, 108, 255, 0.45);
}

.article-main {
  min-width: 0;
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
  line-height: 1.45;
}

.article-meta {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-top: 0.35rem;
  color: var(--vp-c-text-3);
  font-size: 0.84rem;
}

.article-summary {
  display: -webkit-box;
  margin: 0.85rem 0 0;
  overflow: hidden;
  color: var(--vp-c-text-2);
  line-height: 1.6;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.article-summary.muted {
  color: var(--vp-c-text-3);
}

.reject-reason {
  margin: 0.85rem 0 0;
  padding: 0.75rem;
  border-radius: 6px;
  background: #fef3c7;
  color: #92400e;
}

.article-actions {
  display: grid;
  gap: 0.5rem;
  justify-items: stretch;
  min-width: 116px;
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

.btn-secondary:hover,
.btn-success:hover,
.btn-danger:hover,
.btn-warning:hover,
.filter-btn:hover {
  filter: brightness(0.98);
}

.btn-secondary:disabled,
.btn-success:disabled,
.btn-danger:disabled,
.btn-warning:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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

.ghost-danger {
  background: transparent;
  color: #dc2626;
  border-color: rgba(220, 38, 38, 0.35);
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

  .review-summary {
    grid-template-columns: repeat(2, 1fr);
  }

  .review-toolbar,
  .page-header,
  .article-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .article-card {
    grid-template-columns: 1fr;
  }

  .article-actions {
    display: flex;
    flex-wrap: wrap;
  }
}
</style>
