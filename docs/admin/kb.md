---
title: 知识库管理
layout: page
---

<div id="kb-admin-page">
<div class="page-header">
<div>
<p class="eyebrow">管理后台</p>
<h1>知识库管理</h1>
</div>
<a href="/kb" class="btn-secondary">查看知识库</a>
</div>
<nav class="admin-section-nav" aria-label="管理后台导航">
<a href="/admin">文章审核</a>
<a href="/admin/profile-review">个人信息审核</a>
<a class="active" href="/admin/kb">知识库管理</a>
</nav>
<div id="loading" class="state-panel">加载中...</div>
<div id="error" class="state-panel error" style="display:none"></div>
<div id="kb-admin-app" class="kb-admin-layout" style="display:none">
<section class="branch-panel">
<div class="panel-head">
<h2>分支结构</h2>
<button class="btn-secondary" type="button" onclick="resetBranchForm()">新建根分支</button>
</div>
<div id="branch-tree" class="branch-tree"></div>
</section>
<section class="edit-panel">
<h2 id="form-title">创建分支</h2>
<label>
<span>上级分支</span>
<select id="parent-id"></select>
</label>
<label>
<span>分支名称</span>
<input id="branch-name" type="text" placeholder="例如：01-共通基础层">
</label>
<label>
<span>分支标识</span>
<input id="branch-slug" type="text" placeholder="例如：01-common-foundation">
</label>
<label>
<span>排序</span>
<input id="branch-order" type="number" value="0">
</label>
<label>
<span>说明</span>
<textarea id="branch-description" rows="3" placeholder="这个分支收纳什么内容"></textarea>
</label>
<div class="form-actions">
<button class="btn-primary" type="button" onclick="saveBranch()">保存分支</button>
<button id="delete-branch-btn" class="btn-danger" type="button" onclick="deleteBranch()" style="display:none">删除分支</button>
</div>
</section>
<section class="request-panel">
<div class="panel-head">
<h2>新分支申请</h2>
<button class="btn-secondary" type="button" onclick="loadKbAdmin()">刷新</button>
</div>
<div id="branch-requests" class="branch-requests"></div>
</section>
<section class="article-panel">
<div class="panel-head">
<h2>文章归类</h2>
<button class="btn-secondary" type="button" onclick="loadKbAdmin()">刷新</button>
</div>
<div id="article-assignments" class="article-assignments"></div>
</section>
</div>
</div>

<script>
var kbAdminState = { sb: null, branches: [], articles: [], branchRequests: [], selectedBranchId: '' }

function esc(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function show(id, visible) {
  var el = document.getElementById(id)
  if (el) el.style.display = visible ? '' : 'none'
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'branch'
}

function normalizeRequestPath(value) {
  return String(value || '')
    .split('/')
    .map(function(part) { return part.trim() })
    .filter(Boolean)
    .filter(function(part) { return part !== '知识库总览' })
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
  if (!user || !user.id) throw new Error('请先登录管理员账号')

  var profileResult = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (profileResult.error) throw profileResult.error
  if (!profileResult.data || !window.RDPermissions?.derivePermissions(profileResult.data.role).isAdmin) throw new Error('当前账号没有管理员权限')
  return user
}

function childBranches(parentId) {
  return kbAdminState.branches
    .filter(function(branch) { return (branch.parent_id || '') === (parentId || '') })
    .sort(function(a, b) { return (Number(a.sort_order || 0) - Number(b.sort_order || 0)) || String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN') })
}

function flattenBranches(parentId, depth) {
  var rows = []
  childBranches(parentId).forEach(function(branch) {
    rows.push({ branch: branch, depth: depth || 0 })
    rows = rows.concat(flattenBranches(branch.id, (depth || 0) + 1))
  })
  return rows
}

function renderBranchNodes(parentId, depth) {
  var children = childBranches(parentId)
  if (!children.length) return ''

  return '<ul>' + children.map(function(branch) {
    var articleCount = kbAdminState.articles.filter(function(article) { return article.kb_branch_id === branch.id }).length
    return [
      '<li>',
      '  <button class="branch-node ' + (kbAdminState.selectedBranchId === branch.id ? 'active' : '') + '" type="button" onclick="selectBranch(\'' + branch.id + '\')">',
      '    <span>' + esc(branch.name) + '</span>',
      '    <small>' + articleCount + ' 篇</small>',
      '  </button>',
      renderBranchNodes(branch.id, depth + 1),
      '</li>'
    ].join('')
  }).join('') + '</ul>'
}

function branchOptions(selectedId, includeEmpty) {
  var options = includeEmpty ? '<option value="">无上级分支</option>' : '<option value="">不投入知识库</option>'
  flattenBranches('', 0).forEach(function(item) {
    var branch = item.branch
    var prefix = item.depth > 0 ? '　'.repeat(item.depth) + '└ ' : ''
    options += '<option value="' + branch.id + '" ' + (selectedId === branch.id ? 'selected' : '') + '>' + esc(prefix + branch.name) + '</option>'
  })
  return options
}

function renderBranches() {
  var tree = document.getElementById('branch-tree')
  if (!tree) return
  tree.innerHTML = kbAdminState.branches.length
    ? renderBranchNodes('', 0)
    : '<div class="empty-state">还没有分支，先创建一个根分支。</div>'

  var parentSelect = document.getElementById('parent-id')
  if (parentSelect) parentSelect.innerHTML = branchOptions(document.getElementById('parent-id').value, true)
}

function renderArticles() {
  var box = document.getElementById('article-assignments')
  if (!box) return

  var publishedArticles = kbAdminState.articles.filter(function(article) { return article.status === 'published' })
  if (!publishedArticles.length) {
    box.innerHTML = '<div class="empty-state">暂无已发布文章。</div>'
    return
  }

  box.innerHTML = publishedArticles.map(function(article) {
    return [
      '<article class="assignment-row">',
      '  <div>',
      '    <h3>' + esc(article.title) + '</h3>',
      '    <p>' + esc(article.summary || '暂无摘要') + '</p>',
      '  </div>',
      '  <select onchange="assignArticleBranch(\'' + article.id + '\', this.value)">',
      branchOptions(article.kb_enabled ? article.kb_branch_id : '', false),
      '  </select>',
      '</article>'
    ].join('')
  }).join('')
}

function getArticleTitle(articleId) {
  var article = kbAdminState.articles.find(function(item) { return item.id === articleId })
  return article ? article.title : '未知文章'
}

function renderBranchRequests() {
  var box = document.getElementById('branch-requests')
  if (!box) return

  var pending = kbAdminState.branchRequests.filter(function(request) { return (request.status || 'pending') === 'pending' })
  if (!pending.length) {
    box.innerHTML = '<div class="empty-state">暂无待审核的新分支申请。</div>'
    return
  }

  box.innerHTML = pending.map(function(request) {
    var parts = normalizeRequestPath(request.requested_path)
    return [
      '<article class="request-row">',
      '  <div>',
      '    <h3>' + esc(getArticleTitle(request.article_id)) + '</h3>',
      '    <p class="request-path">' + esc(parts.join(' / ')) + '</p>',
      '    <p class="request-meta">提交时间：' + esc(formatDateTime(request.created_at)) + '</p>',
      '  </div>',
      '  <div class="request-actions">',
      '    <button class="btn-primary" type="button" onclick="approveBranchRequest(\'' + request.id + '\')">通过并创建</button>',
      '    <button class="btn-danger" type="button" onclick="rejectBranchRequest(\'' + request.id + '\')">拒绝</button>',
      '  </div>',
      '</article>'
    ].join('')
  }).join('')
}

function renderAll() {
  renderBranches()
  renderBranchRequests()
  renderArticles()
}

function formatDateTime(value) {
  if (!value) return '未知时间'
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function resetBranchForm() {
  kbAdminState.selectedBranchId = ''
  document.getElementById('form-title').textContent = '创建分支'
  document.getElementById('parent-id').value = ''
  document.getElementById('branch-name').value = ''
  document.getElementById('branch-slug').value = ''
  document.getElementById('branch-order').value = '0'
  document.getElementById('branch-description').value = ''
  document.getElementById('delete-branch-btn').style.display = 'none'
  renderBranches()
}

function selectBranch(id) {
  var branch = kbAdminState.branches.find(function(item) { return item.id === id })
  if (!branch) return
  kbAdminState.selectedBranchId = id
  document.getElementById('form-title').textContent = '编辑分支'
  document.getElementById('parent-id').value = branch.parent_id || ''
  document.getElementById('branch-name').value = branch.name || ''
  document.getElementById('branch-slug').value = branch.slug || ''
  document.getElementById('branch-order').value = branch.sort_order || 0
  document.getElementById('branch-description').value = branch.description || ''
  document.getElementById('delete-branch-btn').style.display = 'inline-flex'
  renderBranches()
}

async function saveBranch() {
  var name = document.getElementById('branch-name').value.trim()
  var payload = {
    parent_id: document.getElementById('parent-id').value || null,
    name: name,
    slug: slugify(document.getElementById('branch-slug').value || name),
    sort_order: Number(document.getElementById('branch-order').value || 0),
    description: document.getElementById('branch-description').value.trim() || null,
    updated_at: new Date().toISOString()
  }

  if (!payload.name) {
    alert('请输入分支名称')
    return
  }

  if (kbAdminState.selectedBranchId && payload.parent_id === kbAdminState.selectedBranchId) {
    alert('上级分支不能选择自己')
    return
  }

  var result
  if (kbAdminState.selectedBranchId) {
    result = await kbAdminState.sb.from('knowledge_branches').update(payload).eq('id', kbAdminState.selectedBranchId).select('id')
  } else {
    result = await kbAdminState.sb.from('knowledge_branches').insert(payload).select('id').single()
  }

  if (result.error) {
    alert(window.RDErrors?.toUserMessage(result.error) || '保存失败，请稍后重试')
    return
  }

  await loadKbAdmin()
  resetBranchForm()
}

async function deleteBranch() {
  var id = kbAdminState.selectedBranchId
  if (!id) return
  var hasChildren = kbAdminState.branches.some(function(branch) { return branch.parent_id === id })
  var hasArticles = kbAdminState.articles.some(function(article) { return article.kb_branch_id === id })
  if (hasChildren || hasArticles) {
    alert('该分支下还有子分支或文章，请先调整后再删除')
    return
  }
  if (!confirm('确定删除这个知识库分支吗？')) return

  var result = await kbAdminState.sb.from('knowledge_branches').delete().eq('id', id).select('id')
  if (result.error) {
    alert(window.RDErrors?.toUserMessage(result.error) || '删除失败，请稍后重试')
    return
  }

  await loadKbAdmin()
  resetBranchForm()
}

async function assignArticleBranch(articleId, branchId) {
  var payload = {
    kb_enabled: !!branchId,
    kb_branch_id: branchId || null,
    updated_at: new Date().toISOString()
  }
  var result = await kbAdminState.sb.from('articles').update(payload).eq('id', articleId).select('id')
  if (result.error) {
    alert(window.RDErrors?.toUserMessage(result.error) || '调整失败，请稍后重试')
    return
  }
  var article = kbAdminState.articles.find(function(item) { return item.id === articleId })
  if (article) {
    article.kb_enabled = !!branchId
    article.kb_branch_id = branchId || null
  }
  renderAll()
}

async function createBranch(parentId, name) {
  var siblingCount = childBranches(parentId).length
  var payload = {
    parent_id: parentId || null,
    name: name,
    slug: slugify(name),
    sort_order: siblingCount * 10,
    updated_at: new Date().toISOString()
  }

  var result = await kbAdminState.sb
    .from('knowledge_branches')
    .insert(payload)
    .select('id, parent_id, name, slug, description, sort_order')
    .single()

  if (result.error) throw result.error
  var branch = Array.isArray(result.data) ? result.data[0] : result.data
  kbAdminState.branches.push(branch)
  return branch
}

async function ensureBranchPath(path) {
  var parts = normalizeRequestPath(path)
  if (!parts.length) throw new Error('申请路径为空')

  var parentId = ''
  var current = null
  for (var i = 0; i < parts.length; i++) {
    var name = parts[i]
    var slug = slugify(name)
    current = kbAdminState.branches.find(function(branch) {
      return (branch.parent_id || '') === parentId && (branch.name === name || branch.slug === slug)
    })
    if (!current) current = await createBranch(parentId, name)
    parentId = current.id
  }
  return current.id
}

function getBranchRequest(id) {
  return kbAdminState.branchRequests.find(function(request) { return request.id === id })
}

async function approveBranchRequest(id) {
  var request = getBranchRequest(id)
  if (!request) return
  if (!confirm('确定通过这个新分支申请，并把文章投入该分支吗？')) return

  try {
    var branchId = await ensureBranchPath(request.requested_path)
    var articleResult = await kbAdminState.sb
      .from('articles')
      .update({ kb_enabled: true, kb_branch_id: branchId, updated_at: new Date().toISOString() })
      .eq('id', request.article_id)
      .select('id')

    if (articleResult.error) throw articleResult.error

    var updateResult = await kbAdminState.sb
      .from('knowledge_branch_requests')
      .update({ status: 'approved', reviewed_at: new Date().toISOString(), review_note: null, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id')

    if (updateResult.error) throw updateResult.error
    await loadKbAdmin()
  } catch (error) {
    alert(window.RDErrors?.toUserMessage(error) || '通过失败，请稍后重试')
  }
}

async function rejectBranchRequest(id) {
  var note = prompt('请输入拒绝原因（可选）')
  if (note === null) return

  var updateResult = await kbAdminState.sb
    .from('knowledge_branch_requests')
    .update({ status: 'rejected', review_note: note || '', reviewed_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id')

  if (updateResult.error) {
    alert(window.RDErrors?.toUserMessage(updateResult.error) || '拒绝失败，请稍后重试')
    return
  }
  await loadKbAdmin()
}

async function loadKbAdmin() {
  show('loading', true)
  show('error', false)
  show('kb-admin-app', false)

  try {
    var supabase = await waitForSupabase()
    if (!supabase) throw new Error('Supabase 未加载，请刷新页面后重试')
    kbAdminState.sb = supabase
    await requireAdmin(supabase)

    var branchResult = await supabase
      .from('knowledge_branches')
      .select('id, parent_id, name, slug, description, sort_order')
      .order('sort_order', { ascending: true })
    if (branchResult.error) throw branchResult.error

    var articleResult = await supabase
      .from('articles')
      .select('id, title, summary, status, kb_enabled, kb_branch_id, kb_sort_order, created_at')
      .order('created_at', { ascending: false })
    if (articleResult.error) throw articleResult.error

    var requestResult = await supabase
      .from('knowledge_branch_requests')
      .select('id, article_id, requester_id, requested_path, status, review_note, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (requestResult.error) throw requestResult.error

    kbAdminState.branches = branchResult.data || []
    kbAdminState.articles = articleResult.data || []
    kbAdminState.branchRequests = requestResult.data || []
    renderAll()
    show('loading', false)
    show('kb-admin-app', true)
  } catch (error) {
    show('loading', false)
    var el = document.getElementById('error')
    if (el) {
      el.textContent = window.RDErrors?.toUserMessage(error) || '加载失败，请稍后重试'
      el.style.display = 'block'
    }
  }
}

if (typeof window !== 'undefined') {
  window.loadKbAdmin = loadKbAdmin
  window.resetBranchForm = resetBranchForm
  window.selectBranch = selectBranch
  window.saveBranch = saveBranch
  window.deleteBranch = deleteBranch
  window.assignArticleBranch = assignArticleBranch
  window.approveBranchRequest = approveBranchRequest
  window.rejectBranchRequest = rejectBranchRequest
}

if (typeof document !== 'undefined') setTimeout(loadKbAdmin, 100)
</script>

<style>
#kb-admin-page {
  max-width: 1180px;
  margin: 0 auto;
  padding: 2rem;
}

.page-header,
.panel-head,
.form-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.page-header {
  margin-bottom: 1rem;
}

.page-header h1,
.panel-head h2,
.edit-panel h2 {
  margin: 0;
}

.eyebrow {
  margin: 0 0 0.35rem;
  color: var(--vp-c-brand-1);
  font-size: 0.82rem;
  font-weight: 700;
}

.admin-section-nav {
  display: flex;
  gap: 0.5rem;
  margin: 0 0 1.25rem;
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

.kb-admin-layout {
  display: grid;
  grid-template-columns: minmax(260px, 0.9fr) minmax(280px, 0.95fr);
  gap: 1rem;
}

.request-panel,
.article-panel {
  grid-column: 1 / -1;
}

.branch-panel,
.edit-panel,
.request-panel,
.article-panel,
.state-panel {
  padding: 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
}

.state-panel {
  color: var(--vp-c-text-2);
  text-align: center;
}

.state-panel.error {
  color: #dc2626;
}

.branch-tree {
  margin-top: 1rem;
}

.branch-tree ul {
  margin: 0;
  padding-left: 1.05rem;
  list-style: none;
  border-left: 1px solid var(--vp-c-divider);
}

.branch-tree > ul {
  padding-left: 0;
  border-left: 0;
}

.branch-tree li {
  margin: 0.35rem 0;
}

.branch-node {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
  padding: 0.55rem 0.65rem;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--vp-c-text-1);
  cursor: pointer;
  text-align: left;
}

.branch-node:hover,
.branch-node.active {
  border-color: var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}

.branch-node small {
  color: var(--vp-c-text-3);
  white-space: nowrap;
}

.edit-panel {
  display: grid;
  gap: 0.85rem;
}

.edit-panel label {
  display: grid;
  gap: 0.35rem;
  font-weight: 700;
}

.edit-panel input,
.edit-panel select,
.edit-panel textarea,
.assignment-row select {
  width: 100%;
  padding: 0.58rem 0.7rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font: inherit;
}

.branch-requests,
.article-assignments {
  display: grid;
  gap: 0.75rem;
  margin-top: 1rem;
}

.request-row,
.assignment-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(220px, 320px);
  gap: 1rem;
  align-items: center;
  padding: 0.85rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
}

.request-row h3,
.assignment-row h3 {
  margin: 0 0 0.25rem;
  font-size: 1rem;
}

.request-row p,
.assignment-row p {
  display: -webkit-box;
  margin: 0;
  overflow: hidden;
  color: var(--vp-c-text-2);
  font-size: 0.88rem;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.request-path {
  color: var(--vp-c-text-1) !important;
  font-weight: 700;
}

.request-meta {
  margin-top: 0.35rem !important;
  color: var(--vp-c-text-3) !important;
  font-size: 0.82rem !important;
}

.request-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.btn-primary,
.btn-secondary,
.btn-danger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0.45rem 0.85rem;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  text-decoration: none;
}

.btn-primary {
  background: var(--vp-c-brand-1);
  color: #fff;
}

.btn-secondary {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  border-color: var(--vp-c-divider);
}

.btn-danger {
  background: #dc2626;
  color: #fff;
}

.empty-state {
  padding: 1rem;
  border: 1px dashed var(--vp-c-divider);
  border-radius: 8px;
  color: var(--vp-c-text-2);
  text-align: center;
}

@media (max-width: 820px) {
  #kb-admin-page {
    padding: 1rem;
  }

  .kb-admin-layout,
  .request-row,
  .assignment-row {
    grid-template-columns: 1fr;
  }

  .page-header,
  .panel-head {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
