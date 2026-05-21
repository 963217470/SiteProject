---
title: 文章审核
layout: page
---

<div id="admin-page">
  <div class="page-header">
    <h1>🛠️ 文章审核</h1>
    <div class="header-actions">
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
    <p>暂无待审核文章</p>
  </div>

  <div id="articles-list" class="articles-list" style="display:none">
  </div>
</div>

<script>
function formatDate(d) { 
  const date = new Date(d)
  return date.toLocaleDateString('zh-CN', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }) 
}

function getStatusText(s) {
  const map = {
    draft: '📝 草稿',
    pending: '⏳ 待审核',
    published: '✅ 已发布',
    rejected: '❌ 已拒绝'
  }
  return map[s] || s
}

function getStatusBadgeClass(s) {
  const map = {
    draft: 'badge-draft',
    pending: 'badge-pending',
    published: 'badge-published',
    rejected: 'badge-rejected'
  }
  return map[s] || 'badge-draft'
}

function showError(message) {
  if (typeof document === 'undefined') return
  const loading = document.getElementById('loading')
  const error = document.getElementById('error')
  const errorMessage = document.getElementById('error-message')
  
  loading.style.display = 'none'
  error.style.display = 'block'
  errorMessage.textContent = message
  console.error('Admin page error:', message)
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

  list.innerHTML = data.map(article => `
    <div class="article-card">
      <div class="article-content">
        <div class="article-header">
          <h2>${article.title}</h2>
          <span class="badge ${getStatusBadgeClass(article.status)}">${getStatusText(article.status)}</span>
        </div>
        <div class="article-meta">
          <span>📅 ${formatDate(article.created_at)}</span>
        </div>
        ${article.summary ? `<p class="article-summary">${article.summary}</p>` : ''}
        ${article.reject_reason ? `<p class="reject-reason">❌ 拒绝原因: ${article.reject_reason}</p>` : ''}
        <div class="article-actions">
          ${article.status === 'pending' ? `
            <button class="btn-success" onclick="publishArticle('${article.id}')">✅ 发布</button>
            <button class="btn-danger" onclick="showRejectModal('${article.id}', '${article.title}')">❌ 拒绝</button>
          ` : ''}
          ${article.status === 'published' ? `
            <button class="btn-danger" onclick="unpublishArticle('${article.id}')">⏪ 取消发布</button>
          ` : ''}
          ${article.status === 'draft' || article.status === 'rejected' ? `
            <button class="btn-success" onclick="publishArticle('${article.id}')">✅ 发布</button>
          ` : ''}
          <button class="btn-secondary" onclick="viewArticle('${article.id}')">👁️ 查看</button>
          <button class="btn-danger" onclick="deleteArticle('${article.id}')">🗑️ 删除</button>
        </div>
      </div>
    </div>
  `).join('')
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
    const hasSupabase = await waitForSupabase()
    
    if (!hasSupabase) {
      showError('Supabase 未加载，请刷新页面重试')
      return
    }

    const supabase = window.__supabase

    const { data, error } = await supabase
      .from('articles')
      .select('id, title, summary, status, created_at, reject_reason')
      .order('created_at', { ascending: false })

    if (error) {
      showError('数据库错误: ' + error.message)
      return
    }

    showArticles(data)

  } catch (e) {
    showError('加载失败: ' + e.message)
  }
}

async function updateArticleStatus(id, status, rejectReason = null) {
  try {
    if (typeof window === 'undefined') {
      alert('Supabase 未加载')
      return false
    }
    const supabase = window.__supabase
    if (!supabase) {
      alert('Supabase 未加载')
      return false
    }

    const updateData = {
      status: status,
      updated_at: new Date().toISOString()
    }
    
    if (status === 'published') {
      updateData.published_at = new Date().toISOString()
    } else {
      updateData.reject_reason = rejectReason
    }

    const { error } = await supabase
      .from('articles')
      .update(updateData)
      .eq('id', id)

    if (error) {
      alert('操作失败: ' + error.message)
      return false
    }

    return true
  } catch (e) {
    alert('操作失败: ' + e.message)
    return false
  }
}

async function publishArticle(id) {
  if (!confirm('确定要发布这篇文章吗？')) return
  
  const success = await updateArticleStatus(id, 'published')
  if (success) {
    alert('发布成功！')
    loadArticles()
  }
}

async function unpublishArticle(id) {
  if (!confirm('确定要取消发布这篇文章吗？')) return
  
  const success = await updateArticleStatus(id, 'pending')
  if (success) {
    alert('已取消发布')
    loadArticles()
  }
}

function showRejectModal(id, title) {
  const reason = prompt('请输入拒绝原因（选填）')
  if (reason !== null) {
    rejectArticle(id, reason)
  }
}

async function rejectArticle(id, reason) {
  const success = await updateArticleStatus(id, 'rejected', reason || '')
  if (success) {
    alert('已拒绝')
    loadArticles()
  }
}

async function deleteArticle(id) {
  if (!confirm('确定要删除这篇文章吗？此操作不可恢复！')) return
  
  try {
    if (typeof window === 'undefined') {
      alert('Supabase 未加载')
      return
    }
    const supabase = window.__supabase
    if (!supabase) {
      alert('Supabase 未加载')
      return
    }

    const { error } = await supabase
      .from('articles')
      .delete()
      .eq('id', id)

    if (error) {
      alert('删除失败: ' + error.message)
      return
    }

    alert('删除成功！')
    loadArticles()

  } catch (e) {
    alert('删除失败: ' + e.message)
  }
}

function viewArticle(id) {
  window.open('/SiteProject/article?id=' + id, '_blank')
}

if (typeof document !== 'undefined') {
  setTimeout(() => {
    loadArticles()
  }, 100)
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
  margin-bottom: 2rem;
}

.page-header h1 {
  margin: 0;
}

.header-actions {
  display: flex;
  gap: 0.75rem;
}

.loading, .error, .no-articles {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--vp-c-text-2);
}

.error p:first-child {
  color: #dc2626;
  font-weight: 500;
}

.articles-list {
  display: grid;
  gap: 1rem;
}

.article-card {
  padding: 1.5rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
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
  font-size: 1.25rem;
  flex: 1;
}

.badge {
  padding: 0.25rem 0.75rem;
  border-radius: 20px;
  font-size: 0.8rem;
  font-weight: 500;
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

.article-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.85rem;
  color: var(--vp-c-text-3);
  margin-bottom: 0.75rem;
}

.article-summary {
  margin: 0 0 1rem 0;
  color: var(--vp-c-text-2);
  line-height: 1.6;
}

.reject-reason {
  margin: 0 0 1rem 0;
  padding: 0.75rem;
  background: #fef3c7;
  border-radius: 8px;
  color: #92400e;
}

.article-actions {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn-primary,
.btn-secondary,
.btn-success,
.btn-danger {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-size: 0.875rem;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--vp-c-brand-1);
  color: white;
}

.btn-primary:hover {
  background: var(--vp-c-brand-2);
}

.btn-secondary {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  border: 1px solid var(--vp-c-divider);
}

.btn-secondary:hover {
  background: var(--vp-c-divider);
}

.btn-success {
  background: #059669;
  color: white;
}

.btn-success:hover {
  background: #047857;
}

.btn-danger {
  background: #dc2626;
  color: white;
}

.btn-danger:hover {
  background: #b91c1c;
}

@media (max-width: 768px) {
  .page-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .article-header {
    flex-direction: column;
    align-items: flex-start;
  }

  .article-actions {
    flex-direction: column;
  }
}
</style>
