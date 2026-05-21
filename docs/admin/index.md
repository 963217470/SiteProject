---
title: 文章审核
layout: page
---

<div id="admin-page">
  <div class="page-header">
    <h1>🛠️ 文章审核</h1>
    <div class="header-actions">
      <button class="btn-secondary" onclick="testConnection()">🔧 测试连接</button>
      <button class="btn-secondary" onclick="fixPermissions()">🔓 修复权限</button>
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
            <button class="btn-warning" onclick="unpublishArticle('${article.id}')">⏪ 取消发布</button>
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
  console.log('updateArticleStatus called with id:', id, 'status:', status)
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
    }

    if (status === 'rejected') {
      updateData.reject_reason = rejectReason || ''
    }

    console.log('Updating article with data:', updateData)

    const result = await supabase
      .from('articles')
      .update(updateData)
      .eq('id', id)

    console.log('Update result:', result)

    if (result.error) {
      console.error('Update error:', result.error)
      alert('❌ 操作失败\n\n错误: ' + result.error.message + '\n\n请先点击"🔓 修复权限"按钮来解决权限问题。')
      return false
    }

    console.log('Update successful!')
    return true
  } catch (e) {
    console.error('Exception in updateArticleStatus:', e)
    alert('❌ 操作失败: ' + e.message)
    return false
  }
}

async function publishArticle(id) {
  if (!confirm('确定要发布这篇文章吗？')) return

  const success = await updateArticleStatus(id, 'published')
  if (success) {
    alert('✅ 发布成功！')
    loadArticles()
  }
}

async function unpublishArticle(id) {
  if (!confirm('确定要取消发布这篇文章吗？')) return

  const success = await updateArticleStatus(id, 'pending')
  if (success) {
    alert('✅ 已取消发布')
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
    alert('✅ 已拒绝')
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
      alert('❌ 删除失败: ' + error.message)
      return
    }

    alert('✅ 删除成功！')
    loadArticles()

  } catch (e) {
    alert('❌ 删除失败: ' + e.message)
  }
}

function viewArticle(id) {
  window.open('/SiteProject/article?id=' + id, '_blank')
}

// 直接修复权限的函数（模拟执行SQL）
async function fixPermissions() {
  console.log('=== 开始修复权限 ===')

  const instructions = `
🔓 权限修复指南

由于浏览器安全限制，无法直接修改数据库权限。
请按以下步骤操作：

1️⃣ 打开 Supabase Dashboard
   https://supabase.com/dashboard

2️⃣ 进入您的项目

3️⃣ 进入 Table Editor
   左侧菜单 → Table Editor → 选择 "articles" 表

4️⃣ 修改 RLS 设置
   - 点击 "Policies" 标签
   - 点击 "Disable RLS" 按钮
   - 确认禁用

5️⃣ 刷新本页面

6️⃣ 再次尝试发布文章

================================

如果您想更精细地控制权限，可以：

进入 SQL Editor，执行：
ALTER TABLE articles DISABLE ROW LEVEL SECURITY;

如果只想允许更新操作：
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow_all_updates" ON articles FOR UPDATE USING (true);

================================
`

  alert(instructions)
  console.log(instructions)

  // 尝试直接访问Supabase（这不会成功，但可以给用户提示）
  const shouldOpenSupabase = confirm('是否打开 Supabase Dashboard？')
  if (shouldOpenSupabase) {
    window.open('https://supabase.com/dashboard', '_blank')
  }
}

async function testConnection() {
  console.log('Testing Supabase connection...')
  alert('开始诊断...\n\n请在弹出的确认框后，查看浏览器控制台（F12）的详细信息')

  if (typeof window === 'undefined' || !window.__supabase) {
    alert('❌ Supabase 未加载\n\n请刷新页面重试')
    return
  }

  try {
    console.log('=== 开始 Supabase 诊断 ===')

    // 步骤1：测试SELECT
    console.log('1. 测试 SELECT...')
    const { data: selectData, error: selectError } = await window.__supabase
      .from('articles')
      .select('id, title, status')
      .limit(10)

    if (selectError) {
      console.error('❌ SELECT 失败:', selectError)
      alert('❌ SELECT 操作失败\n\n错误: ' + selectError.message + '\n\n这通常是 RLS 策略阻止了查询。\n\n请在 Supabase Table Editor 中禁用 articles 表的 RLS。')
      return
    }

    console.log('✅ SELECT 成功，找到', selectData?.length || 0, '篇文章')

    if (!selectData || selectData.length === 0) {
      alert('✅ SELECT 成功\n\n但目前没有任何文章。\n\n请先在编辑器页面创建一篇测试文章。')
      return
    }

    // 步骤2：测试UPDATE
    const testArticle = selectData[0]
    console.log('2. 测试 UPDATE on article ID:', testArticle.id)

    const testStatus = testArticle.status === 'pending' ? 'published' : 'pending'
    const { error: updateError } = await window.__supabase
      .from('articles')
      .update({
        status: testStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', testArticle.id)

    if (updateError) {
      console.error('❌ UPDATE 失败:', updateError)
      alert('❌ UPDATE 操作失败\n\n错误: ' + updateError.message + '\n\n这通常是 RLS 策略阻止了更新操作。\n\n请在 Supabase Table Editor 中禁用 articles 表的 RLS。')
      return
    }

    console.log('✅ UPDATE 成功，状态已切换为', testStatus)

    // 步骤3：恢复原状态
    await window.__supabase
      .from('articles')
      .update({
        status: testArticle.status,
        updated_at: new Date().toISOString()
      })
      .eq('id', testArticle.id)

    console.log('✅ 测试完成！所有操作都正常工作')
    alert('✅ 诊断完成！\n\n所有操作都正常工作：\n- ✅ SELECT 查询成功\n- ✅ UPDATE 更新成功\n\n现在您可以正常审核文章了。')

    // 刷新文章列表
    loadArticles()

  } catch (e) {
    console.error('❌ 测试异常:', e)
    alert('❌ 测试失败\n\n错误: ' + e.message)
  }
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
.btn-danger,
.btn-warning {
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

.btn-warning {
  background: #f59e0b;
  color: white;
}

.btn-warning:hover {
  background: #d97706;
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
