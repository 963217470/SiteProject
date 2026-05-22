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

  <div id="article-shell" class="article-shell" style="display:none"></div>
</div>

<script>
var articleState = {
  id: '',
  article: null,
  comments: [],
  profiles: {},
  session: null,
  liked: false,
  favoriteTableReady: true,
  favorited: false
}

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
  return { public: '公开', internal: '内部' }[value] || value || '公开'
}

function getStatusText(value) {
  return { draft: '草稿', pending: '待审核', published: '已发布', rejected: '已拒绝' }[value] || value || ''
}

function getReadingMinutes(content) {
  var length = String(content || '').replace(/\s/g, '').length
  return Math.max(1, Math.ceil(length / 500))
}

function getLocalFavorites() {
  try {
    return JSON.parse(localStorage.getItem('rd_article_favorites') || '[]')
  } catch (e) {
    return []
  }
}

function setLocalFavorite(id, enabled) {
  var list = getLocalFavorites().filter(function(item) { return item !== id })
  if (enabled) list.push(id)
  localStorage.setItem('rd_article_favorites', JSON.stringify(list))
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

function withTimeout(promise, fallback, timeoutMs) {
  timeoutMs = timeoutMs || 5000
  return Promise.race([
    promise,
    new Promise(function(resolve) {
      setTimeout(function() { resolve(fallback) }, timeoutMs)
    })
  ])
}

function getUserName(userId) {
  var profile = articleState.profiles[userId]
  return (profile && (profile.username || profile.full_name)) || '社团成员'
}

function getUserAvatar(userId) {
  var profile = articleState.profiles[userId]
  return (profile && profile.avatar_url) || '/SiteProject/images/default-avatar.svg'
}

function renderActionButton(type, label, count, active) {
  return [
    '<button class="action-btn ' + (active ? 'active' : '') + '" onclick="' + type + '()">',
    '  <span class="action-label">' + label + '</span>',
    '  <strong>' + count + '</strong>',
    '</button>'
  ].join('')
}

function renderComments() {
  if (!articleState.comments.length) {
    return '<div class="empty-comments">还没有评论，来写下第一条想法吧。</div>'
  }

  return articleState.comments.map(function(comment) {
    return [
      '<div class="comment-item">',
      '  <img class="comment-avatar" src="' + escapeHtml(getUserAvatar(comment.user_id)) + '" alt="">',
      '  <div class="comment-main">',
      '    <div class="comment-head">',
      '      <strong>' + escapeHtml(getUserName(comment.user_id)) + '</strong>',
      '      <span>' + formatDate(comment.created_at) + '</span>',
      '    </div>',
      '    <p>' + escapeHtml(comment.content) + '</p>',
      '  </div>',
      '</div>'
    ].join('')
  }).join('')
}

function renderArticle() {
  var article = articleState.article
  if (!article) return
  var shell = document.getElementById('article-shell')
  var authorName = getUserName(article.author_id)
  var authorAvatar = getUserAvatar(article.author_id)
  var likeCount = article.likes_count || 0
  var commentCount = article.comments_count || articleState.comments.length || 0
  var favoriteLabel = articleState.favoriteTableReady ? '收藏' : '本地收藏'

  shell.innerHTML = [
    '<a href="/SiteProject/articles" class="back-link">返回文章列表</a>',
    '<div class="article-layout">',
    '  <main class="reader-main">',
    article.cover_url ? '    <img src="' + escapeHtml(article.cover_url) + '" class="article-cover" alt="' + escapeHtml(article.title) + '">' : '',
    '    <article class="reader-card">',
    '      <header class="article-header">',
    '        <div class="article-kicker">',
    '          <span>' + escapeHtml(getVisibilityText(article.visibility)) + '</span>',
    '          <span>' + escapeHtml(getStatusText(article.status)) + '</span>',
    '          <span>约 ' + getReadingMinutes(article.content) + ' 分钟阅读</span>',
    '        </div>',
    '        <h1>' + escapeHtml(article.title) + '</h1>',
    '        <div class="author-row">',
    '          <img class="author-avatar" src="' + escapeHtml(authorAvatar) + '" alt="">',
    '          <div>',
    '            <strong>' + escapeHtml(authorName) + '</strong>',
    '            <span>' + formatDate(article.created_at) + '</span>',
    '          </div>',
    '        </div>',
    article.tags && article.tags.length ? '        <div class="article-tags">' + article.tags.map(function(tag) { return '<a class="tag" href="/SiteProject/articles?tag=' + encodeURIComponent(tag) + '">#' + escapeHtml(tag) + '</a>' }).join('') + '</div>' : '',
    '      </header>',
    article.summary ? '      <div class="article-summary">' + escapeHtml(article.summary) + '</div>' : '',
    '      <div class="article-body">' + renderMarkdown(article.content || '') + '</div>',
    '    </article>',
    '    <section class="comment-section" id="comments">',
    '      <div class="section-title">',
    '        <h2>评论</h2>',
    '        <span>' + commentCount + ' 条讨论</span>',
    '      </div>',
    articleState.session ? [
    '      <div class="comment-editor">',
    '        <textarea id="comment-input" placeholder="写下你的评论..."></textarea>',
    '        <button onclick="submitComment()">发布评论</button>',
    '      </div>'
    ].join('') : '      <div class="login-tip">登录后可以参与评论、点赞和收藏。</div>',
    '      <div id="comment-list" class="comment-list">' + renderComments() + '</div>',
    '    </section>',
    '  </main>',
    '  <aside class="reader-side">',
    '    <div class="sticky-panel">',
    '      <div class="side-author">',
    '        <img src="' + escapeHtml(authorAvatar) + '" alt="">',
    '        <div>',
    '          <span>作者</span>',
    '          <strong>' + escapeHtml(authorName) + '</strong>',
    '        </div>',
    '      </div>',
    '      <div class="action-stack">',
    renderActionButton('toggleLike', '点赞', likeCount, articleState.liked),
    renderActionButton('toggleFavorite', favoriteLabel, articleState.favorited ? '已收藏' : '未收藏', articleState.favorited),
    '        <a class="action-link" href="#comments">查看评论 ' + commentCount + '</a>',
    '      </div>',
    articleState.favoriteTableReady ? '' : '      <p class="side-note">收藏表未创建，当前收藏仅保存在本机浏览器。</p>',
    '    </div>',
    '  </aside>',
    '</div>'
  ].join('')
}

async function loadProfiles(supabase, userIds) {
  var ids = Array.from(new Set(userIds.filter(Boolean)))
  if (!ids.length) return

  var result = await withTimeout(
    supabase
      .from('profiles')
      .select('id, username, full_name, avatar_url')
      .in('id', ids),
    { data: [], error: { message: 'profiles timeout' } }
  )

  if (!result.error && result.data) {
    result.data.forEach(function(profile) {
      articleState.profiles[profile.id] = profile
    })
  }
}

async function loadInteractionState(supabase) {
  var sessionResult = await withTimeout(
    supabase.auth.getSession(),
    { data: { session: null }, error: { message: 'session timeout' } }
  )
  articleState.session = sessionResult.data.session
  var user = articleState.session && articleState.session.user

  if (!user) {
    articleState.favorited = getLocalFavorites().includes(articleState.id)
    return
  }

  var likeResult = await withTimeout(
    supabase
      .from('article_likes')
      .select('article_id, user_id')
      .eq('article_id', articleState.id)
      .eq('user_id', user.id)
      .limit(1),
    { data: [], error: { message: 'likes timeout' } }
  )
  articleState.liked = !!(likeResult.data && likeResult.data.length)

  var favoriteResult = await withTimeout(
    supabase
      .from('article_favorites')
      .select('article_id, user_id')
      .eq('article_id', articleState.id)
      .eq('user_id', user.id)
      .limit(1),
    { data: [], error: { message: 'favorites timeout' } }
  )

  if (favoriteResult.error) {
    articleState.favoriteTableReady = false
    articleState.favorited = getLocalFavorites().includes(articleState.id)
  } else {
    articleState.favoriteTableReady = true
    articleState.favorited = !!(favoriteResult.data && favoriteResult.data.length)
  }
}

async function loadComments(supabase) {
  var result = await withTimeout(
    supabase
      .from('comments')
      .select('id, article_id, user_id, content, created_at, updated_at')
      .eq('article_id', articleState.id)
      .order('created_at', { ascending: true }),
    { data: [], error: { message: 'comments timeout' } }
  )

  if (!result.error) {
    articleState.comments = result.data || []
  }
}

async function updateArticleCount(supabase, patch) {
  var result = await supabase
    .from('articles')
    .update(patch)
    .eq('id', articleState.id)
    .select('id, likes_count, comments_count')
    .limit(1)

  if (!result.error && result.data && result.data[0]) {
    articleState.article.likes_count = result.data[0].likes_count
    articleState.article.comments_count = result.data[0].comments_count
  }
}

async function toggleLike() {
  var supabase = window.__supabase
  var sessionResult = await supabase.auth.getSession()
  var session = sessionResult.data.session
  if (!session) {
    alert('请先登录后再点赞')
    return
  }

  var userId = session.user.id
  if (articleState.liked) {
    await supabase.from('article_likes').delete().eq('article_id', articleState.id).eq('user_id', userId)
    articleState.liked = false
    articleState.article.likes_count = Math.max(0, (articleState.article.likes_count || 0) - 1)
  } else {
    var exists = await supabase.from('article_likes').select('article_id').eq('article_id', articleState.id).eq('user_id', userId).limit(1)
    if (!exists.data || !exists.data.length) {
      await supabase.from('article_likes').insert({ article_id: articleState.id, user_id: userId })
      articleState.article.likes_count = (articleState.article.likes_count || 0) + 1
    }
    articleState.liked = true
  }

  await updateArticleCount(supabase, { likes_count: articleState.article.likes_count })
  renderArticle()
}

async function toggleFavorite() {
  var supabase = window.__supabase
  var sessionResult = await supabase.auth.getSession()
  var session = sessionResult.data.session

  if (!session || !articleState.favoriteTableReady) {
    articleState.favorited = !articleState.favorited
    setLocalFavorite(articleState.id, articleState.favorited)
    renderArticle()
    return
  }

  var userId = session.user.id
  if (articleState.favorited) {
    await supabase.from('article_favorites').delete().eq('article_id', articleState.id).eq('user_id', userId)
    articleState.favorited = false
  } else {
    var exists = await supabase.from('article_favorites').select('article_id').eq('article_id', articleState.id).eq('user_id', userId).limit(1)
    if (!exists.data || !exists.data.length) {
      await supabase.from('article_favorites').insert({ article_id: articleState.id, user_id: userId })
    }
    articleState.favorited = true
  }

  renderArticle()
}

async function submitComment() {
  var input = document.getElementById('comment-input')
  var content = input ? input.value.trim() : ''
  if (!content) return

  var supabase = window.__supabase
  var sessionResult = await supabase.auth.getSession()
  var session = sessionResult.data.session
  if (!session) {
    alert('请先登录后再评论')
    return
  }

  var insert = await supabase
    .from('comments')
    .insert({ article_id: articleState.id, user_id: session.user.id, content: content })
    .select('id, article_id, user_id, content, created_at, updated_at')

  if (insert.error) {
    alert('评论失败：' + insert.error.message)
    return
  }

  articleState.comments.push(insert.data[0])
  articleState.article.comments_count = (articleState.article.comments_count || 0) + 1
  await updateArticleCount(supabase, { comments_count: articleState.article.comments_count })
  await loadProfiles(supabase, [session.user.id])
  renderArticle()
}

async function loadArticle() {
  setVisible('loading', true)
  setVisible('error', false)
  setVisible('article-not-found', false)
  setVisible('article-shell', false)

  try {
    articleState.id = new URLSearchParams(window.location.search).get('id') || ''
    if (!articleState.id) {
      setVisible('loading', false)
      setVisible('article-not-found', true)
      return
    }

    var supabase = await waitForSupabase()
    if (!supabase) throw new Error('Supabase 未加载，请刷新页面后重试')

    var result = await supabase
      .from('articles')
      .select('id, title, summary, content, cover_url, tags, visibility, status, author_id, created_at, likes_count, comments_count')
      .eq('id', articleState.id)
      .single()

    if (result.error) throw new Error(result.error.message)
    if (!result.data) {
      setVisible('loading', false)
      setVisible('article-not-found', true)
      return
    }

    articleState.article = result.data
    document.title = articleState.article.title + ' | RD STUDIO'

    setVisible('loading', false)
    setVisible('article-shell', true)
    renderArticle()

    Promise.all([
      loadInteractionState(supabase),
      loadComments(supabase)
    ]).then(function() {
      return loadProfiles(supabase, [articleState.article.author_id].concat(articleState.comments.map(function(comment) { return comment.user_id })))
    }).then(function() {
      renderArticle()
    }).catch(function(error) {
      console.warn('Article interaction load skipped:', error)
    })
  } catch (error) {
    setVisible('loading', false)
    setVisible('error', true)
    document.getElementById('error-message').textContent = '加载失败：' + (error.message || '未知错误')
  }
}

if (typeof window !== 'undefined') {
  window.toggleLike = toggleLike
  window.toggleFavorite = toggleFavorite
  window.submitComment = submitComment
}

if (typeof document !== 'undefined') {
  setTimeout(loadArticle, 100)
}
</script>

<style>
#article-page {
  max-width: 1180px;
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
  margin-bottom: 1.25rem;
  color: var(--vp-c-brand-1);
  text-decoration: none;
}

.article-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 2rem;
  align-items: start;
}

.reader-main {
  min-width: 0;
}

.reader-card,
.comment-section,
.sticky-panel {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
}

.article-cover {
  width: 100%;
  max-height: 420px;
  object-fit: cover;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.reader-card {
  padding: 2rem;
}

.article-kicker {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
}

.article-kicker span {
  padding: 0.25rem 0.55rem;
  border-radius: 4px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  font-size: 0.8rem;
}

.article-header h1 {
  margin: 0 0 1rem;
  font-size: 2.25rem;
  line-height: 1.25;
}

.author-row,
.side-author,
.comment-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.author-avatar,
.side-author img,
.comment-avatar {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  object-fit: cover;
}

.author-row span,
.side-author span,
.comment-head span {
  display: block;
  color: var(--vp-c-text-3);
  font-size: 0.82rem;
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
  text-decoration: none;
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
  line-height: 1.85;
  font-size: 1rem;
}

.article-body h1,
.article-body h2,
.article-body h3 {
  margin: 1.75rem 0 0.75rem;
}

.article-body code {
  padding: 0.15rem 0.35rem;
  border-radius: 4px;
  background: var(--vp-c-bg-soft);
}

.reader-side {
  position: sticky;
  top: 88px;
}

.sticky-panel {
  padding: 1rem;
}

.side-author {
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--vp-c-divider);
}

.action-stack {
  display: grid;
  gap: 0.75rem;
  margin-top: 1rem;
}

.action-btn,
.action-link {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding: 0.8rem 0.9rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  text-decoration: none;
  cursor: pointer;
}

.action-btn.active {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.action-label {
  font-size: 0.9rem;
}

.side-note {
  margin: 0.9rem 0 0;
  color: var(--vp-c-text-3);
  font-size: 0.78rem;
  line-height: 1.5;
}

.comment-section {
  margin-top: 1.5rem;
  padding: 1.5rem;
}

.section-title {
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  align-items: center;
  margin-bottom: 1rem;
}

.section-title h2 {
  margin: 0;
  font-size: 1.25rem;
}

.section-title span {
  color: var(--vp-c-text-3);
  font-size: 0.85rem;
}

.comment-editor {
  display: grid;
  gap: 0.75rem;
  margin-bottom: 1.25rem;
}

.comment-editor textarea {
  min-height: 96px;
  resize: vertical;
  padding: 0.85rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
}

.comment-editor button {
  justify-self: end;
  padding: 0.65rem 1.1rem;
  border: 0;
  border-radius: 8px;
  background: var(--vp-c-brand-1);
  color: white;
  cursor: pointer;
}

.login-tip,
.empty-comments {
  padding: 1rem;
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
}

.comment-list {
  display: grid;
  gap: 1rem;
}

.comment-item {
  align-items: flex-start;
  padding-top: 1rem;
  border-top: 1px solid var(--vp-c-divider);
}

.comment-main {
  flex: 1;
  min-width: 0;
}

.comment-head {
  display: flex;
  gap: 0.75rem;
  align-items: baseline;
  flex-wrap: wrap;
}

.comment-main p {
  margin: 0.35rem 0 0;
  line-height: 1.7;
}

@media (max-width: 960px) {
  #article-page {
    padding: 1rem;
  }

  .article-layout {
    grid-template-columns: 1fr;
  }

  .reader-side {
    position: static;
    order: -1;
  }

  .article-header h1 {
    font-size: 1.7rem;
  }

  .reader-card,
  .comment-section {
    padding: 1.25rem;
  }
}
</style>
