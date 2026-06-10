---
title: 知识库
layout: page
---

<div id="kb-page">
<header class="kb-header">
<div>
<p class="eyebrow">RD STUDIO</p>
<h1>知识库</h1>
</div>
<a class="submit-link" href="/editor">投稿文章</a>
</header>
<div id="loading" class="state-panel">加载中...</div>
<div id="error" class="state-panel error" style="display:none"></div>
<section id="kb-app" class="kb-layout" style="display:none">
<aside class="kb-tree-panel">
<div class="tree-title">分支目录</div>
<div id="kb-tree" class="kb-tree"></div>
</aside>
<main class="kb-main">
<div class="branch-heading">
<p id="branch-path">全部分支</p>
<h2 id="branch-title">知识库总览</h2>
<p id="branch-description">按固定分支整理文章，让新成员可以沿着路线阅读。</p>
</div>
<div id="branch-articles" class="branch-articles"></div>
</main>
</section>
</div>

<script>
var kbState = { branches: [], articles: [], activeBranchId: '' }

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

function formatDate(value) {
  if (!value) return '未知时间'
  return new Date(value).toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' })
}

function getCover(article) {
  if (article.cover_url) return article.cover_url
  var match = String(article.content || '').match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+|data:image\/[^)]+)\)/i)
  return match ? match[1] : ''
}

function buildSummary(article) {
  return String(article.summary || article.content || '')
    .replace(/!\[[^\]]*\]\([^)]+\)/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/[#>*_`~\[\]()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

async function waitForSupabase(maxAttempts) {
  maxAttempts = maxAttempts || 30
  for (var i = 0; i < maxAttempts; i++) {
    if (typeof window !== 'undefined' && window.__supabase) return window.__supabase
    await new Promise(function(resolve) { setTimeout(resolve, 100) })
  }
  return null
}

function childBranches(parentId) {
  return kbState.branches
    .filter(function(branch) { return (branch.parent_id || '') === (parentId || '') })
    .sort(function(a, b) { return (Number(a.sort_order || 0) - Number(b.sort_order || 0)) || String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN') })
}

function branchArticleCount(branchId) {
  var ids = collectBranchIds(branchId)
  return kbState.articles.filter(function(article) { return ids.indexOf(article.kb_branch_id) !== -1 }).length
}

function collectBranchIds(branchId) {
  var ids = [branchId]
  childBranches(branchId).forEach(function(child) {
    ids = ids.concat(collectBranchIds(child.id))
  })
  return ids
}

function renderTreeNodes(parentId) {
  var children = childBranches(parentId)
  if (!children.length) return ''

  return '<ul>' + children.map(function(branch) {
    var count = branchArticleCount(branch.id)
    return [
      '<li>',
      '  <button class="tree-node ' + (kbState.activeBranchId === branch.id ? 'active' : '') + '" type="button" data-branch-id="' + esc(branch.id) + '" onclick="selectBranch(\'' + branch.id + '\')">',
      '    <span>' + esc(branch.name) + '</span>',
      '    <small>' + count + '</small>',
      '  </button>',
      renderTreeNodes(branch.id),
      '</li>'
    ].join('')
  }).join('') + '</ul>'
}

function branchPath(branch) {
  var names = []
  var current = branch
  while (current) {
    names.unshift(current.name)
    current = kbState.branches.find(function(item) { return item.id === current.parent_id })
  }
  return names.join(' / ')
}

function normalizeBranchTarget(value) {
  return String(value || '')
    .trim()
    .replace(/^知识库总览\s*\/\s*/, '')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s+/g, '')
    .toLowerCase()
}

function findBranchByTarget(value) {
  var target = normalizeBranchTarget(value)
  if (!target) return null
  return kbState.branches.find(function(branch) {
    return branch.id === value
      || normalizeBranchTarget(branch.name) === target
      || normalizeBranchTarget(branchPath(branch)) === target
  }) || null
}

function visibleArticles() {
  if (!kbState.activeBranchId) return kbState.articles
  var ids = collectBranchIds(kbState.activeBranchId)
  return kbState.articles.filter(function(article) { return ids.indexOf(article.kb_branch_id) !== -1 })
}

function renderArticles() {
  var list = document.getElementById('branch-articles')
  if (!list) return

  var rows = visibleArticles()
  if (!rows.length) {
    list.innerHTML = '<div class="empty-state">这个分支还没有文章。</div>'
    return
  }

  list.innerHTML = rows.map(function(article) {
    var cover = getCover(article)
    return [
      '<article class="kb-article-card">',
      cover ? '<img src="' + esc(cover) + '" alt="" onerror="this.style.display=\'none\'">' : '<div class="cover-placeholder"></div>',
      '  <div class="kb-article-body">',
      '    <h3><a href="/article?id=' + encodeURIComponent(article.id) + '">' + esc(article.title) + '</a></h3>',
      '    <p>' + esc(buildSummary(article)) + '</p>',
      '    <div class="article-meta">',
      '      <span>' + formatDate(article.created_at) + '</span>',
      '      <span>' + esc(article.visibility === 'internal' ? '内部' : '公开') + '</span>',
      '      <span>赞 ' + Number(article.likes_count || 0) + '</span>',
      '      <span>评 ' + Number(article.comments_count || 0) + '</span>',
      '    </div>',
      '  </div>',
      '</article>'
    ].join('')
  }).join('')
}

function renderPage() {
  var tree = document.getElementById('kb-tree')
  if (tree) {
    tree.innerHTML = [
      '<button class="tree-node root-node ' + (!kbState.activeBranchId ? 'active' : '') + '" type="button" onclick="selectBranch(\'\')">',
      '  <span>知识库总览</span>',
      '  <small>' + kbState.articles.length + '</small>',
      '</button>',
      kbState.branches.length ? renderTreeNodes('') : '<div class="empty-state">还没有知识库分支。</div>'
    ].join('')
  }

  var active = kbState.branches.find(function(branch) { return branch.id === kbState.activeBranchId })
  document.getElementById('branch-title').textContent = active ? active.name : '知识库总览'
  document.getElementById('branch-path').textContent = active ? branchPath(active) : '全部分支'
  document.getElementById('branch-description').textContent = active && active.description ? active.description : '按固定分支整理文章，让新成员可以沿着路线阅读。'
  renderArticles()

  if (active) {
    requestAnimationFrame(function() {
      var node = document.querySelector('[data-branch-id="' + active.id + '"]')
      if (node) node.scrollIntoView({ block: 'center', behavior: 'smooth' })
    })
  }
}

function selectBranch(id, skipUrl) {
  kbState.activeBranchId = id || ''
  if (!skipUrl && window.history) {
    var active = kbState.branches.find(function(branch) { return branch.id === kbState.activeBranchId })
    var url = new URL(window.location.href)
    if (active) url.searchParams.set('branch', branchPath(active))
    else url.searchParams.delete('branch')
    window.history.replaceState(null, '', url.toString())
  }
  renderPage()
}

function applyInitialBranchFromUrl() {
  var params = new URLSearchParams(window.location.search)
  var target = params.get('branch') || params.get('path') || params.get('id') || ''
  var branch = findBranchByTarget(target)
  kbState.activeBranchId = branch ? branch.id : ''
}

async function loadKnowledgeBase() {
  show('loading', true)
  show('error', false)
  show('kb-app', false)

  try {
    var supabase = await waitForSupabase()
    if (!supabase) throw new Error('Supabase 未加载，请刷新页面后重试')

    var branchResult = await supabase
      .from('knowledge_branches')
      .select('id, parent_id, name, description, sort_order')
      .order('sort_order', { ascending: true })
    if (branchResult.error) throw new Error('知识库还没有初始化，请管理员执行 supabase/knowledge-base.sql')

    var articleResult = await supabase
      .from('articles')
      .select('id, title, summary, content, cover_url, visibility, created_at, likes_count, comments_count, kb_enabled, kb_branch_id, kb_sort_order')
      .eq('status', 'published')
      .eq('kb_enabled', true)
      .order('kb_sort_order', { ascending: true })
    if (articleResult.error) throw new Error('知识库文章读取失败：' + articleResult.error.message)

    kbState.branches = branchResult.data || []
    kbState.articles = articleResult.data || []
    applyInitialBranchFromUrl()
    renderPage()
    show('loading', false)
    show('kb-app', true)
  } catch (error) {
    show('loading', false)
    var el = document.getElementById('error')
    if (el) {
      el.textContent = error.message || '加载失败'
      el.style.display = 'block'
    }
  }
}

if (typeof window !== 'undefined') {
  window.selectBranch = selectBranch
  window.loadKnowledgeBase = loadKnowledgeBase
}

if (typeof document !== 'undefined') setTimeout(loadKnowledgeBase, 100)
</script>

<style>
#kb-page {
  max-width: 1180px;
  margin: 0 auto;
  padding: 2rem;
}

.kb-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.eyebrow {
  margin: 0 0 0.3rem;
  color: var(--vp-c-brand-1);
  font-size: 0.82rem;
  font-weight: 700;
}

.kb-header h1 {
  margin: 0;
  font-size: 2rem;
}

.submit-link {
  padding: 0.58rem 0.9rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  text-decoration: none;
}

.kb-layout {
  display: grid;
  grid-template-columns: minmax(250px, 320px) minmax(0, 1fr);
  gap: 1.25rem;
  align-items: start;
}

.kb-tree-panel,
.kb-main,
.state-panel {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
}

.kb-tree-panel {
  position: sticky;
  top: 88px;
  max-height: calc(100vh - 120px);
  overflow: auto;
  padding: 0.85rem;
}

.tree-title {
  padding: 0 0.45rem 0.65rem;
  color: var(--vp-c-text-2);
  font-size: 0.86rem;
  font-weight: 700;
}

.kb-tree ul {
  margin: 0;
  padding-left: 1rem;
  list-style: none;
  border-left: 1px solid var(--vp-c-divider);
}

.kb-tree > ul {
  margin-top: 0.35rem;
}

.kb-tree li {
  margin: 0.2rem 0;
}

.tree-node {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  width: 100%;
  min-height: 36px;
  padding: 0.45rem 0.55rem;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  color: var(--vp-c-text-1);
  cursor: pointer;
  text-align: left;
}

.tree-node:hover,
.tree-node.active {
  border-color: var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}

.tree-node small {
  min-width: 1.6rem;
  color: var(--vp-c-text-3);
  text-align: right;
}

.root-node {
  font-weight: 700;
}

.kb-main {
  min-height: 520px;
  padding: 1.25rem;
}

.branch-heading {
  padding-bottom: 1rem;
  margin-bottom: 1rem;
  border-bottom: 1px solid var(--vp-c-divider);
}

.branch-heading p {
  margin: 0;
  color: var(--vp-c-text-2);
}

.branch-heading h2 {
  margin: 0.25rem 0 0.45rem;
  font-size: 1.65rem;
}

.branch-articles {
  display: grid;
  gap: 0.85rem;
}

.kb-article-card {
  display: grid;
  grid-template-columns: 154px minmax(0, 1fr);
  gap: 1rem;
  padding: 0.85rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
}

.kb-article-card img,
.cover-placeholder {
  width: 154px;
  height: 104px;
  object-fit: cover;
  border-radius: 6px;
  background: linear-gradient(135deg, var(--vp-c-brand-soft), var(--vp-c-bg));
}

.kb-article-body h3 {
  margin: 0 0 0.45rem;
  font-size: 1.08rem;
  line-height: 1.45;
}

.kb-article-body h3 a {
  color: var(--vp-c-text-1);
  text-decoration: none;
}

.kb-article-body h3 a:hover {
  color: var(--vp-c-brand-1);
}

.kb-article-body p {
  display: -webkit-box;
  margin: 0 0 0.65rem;
  overflow: hidden;
  color: var(--vp-c-text-2);
  line-height: 1.65;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
}

.article-meta {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  color: var(--vp-c-text-3);
  font-size: 0.84rem;
}

.state-panel,
.empty-state {
  padding: 1rem;
  color: var(--vp-c-text-2);
  text-align: center;
}

.state-panel.error {
  color: #dc2626;
}

.empty-state {
  border: 1px dashed var(--vp-c-divider);
  border-radius: 8px;
}

@media (max-width: 820px) {
  #kb-page {
    padding: 1rem;
  }

  .kb-header,
  .kb-layout,
  .kb-article-card {
    grid-template-columns: 1fr;
  }

  .kb-header {
    flex-direction: column;
  }

  .kb-tree-panel {
    position: static;
    max-height: none;
  }

  .kb-article-card img,
  .cover-placeholder {
    width: 100%;
    height: 180px;
  }
}
</style>
