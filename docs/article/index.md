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

function saveRecentArticle(article) {
  if (!article || !article.id) return
  try {
    var key = 'rd_recent_articles'
    var list = JSON.parse(localStorage.getItem(key) || '[]')
    if (!Array.isArray(list)) list = []
    list = list.filter(function(item) { return item && item.id !== article.id })
    list.unshift({
      id: article.id,
      title: article.title,
      cover_url: article.cover_url || '',
      summary: article.summary || '',
      viewed_at: new Date().toISOString()
    })
    localStorage.setItem(key, JSON.stringify(list.slice(0, 30)))
  } catch (e) {}
}

async function loadArticleRecord(supabase, id) {
  var result = await supabase
    .from('articles')
    .select('id, title, summary, content, cover_url, tags, visibility, status, author_id, created_at, likes_count, comments_count, views_count')
    .eq('id', id)
    .single()

  if (!result.error) return result

  return supabase
    .from('articles')
    .select('id, title, summary, content, cover_url, tags, visibility, status, author_id, created_at, likes_count, comments_count')
    .eq('id', id)
    .single()
}

async function updateViewCountIfAvailable(supabase) {
  if (!articleState.article || typeof articleState.article.views_count === 'undefined') return
  var nextCount = Number(articleState.article.views_count || 0) + 1
  articleState.article.views_count = nextCount
  await supabase
    .from('articles')
    .update({ views_count: nextCount })
    .eq('id', articleState.id)
}

function renderMarkdown(content) {
  var html = escapeHtml(content)
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+|data:image\/[^)]+)\)/g, '<figure class="article-image"><img src="$2" alt="$1"><figcaption>$1</figcaption></figure>')
    .replace(/&lt;span style=&quot;color:\s*(#[0-9a-fA-F]{3,8}|[a-zA-Z]+);?&quot;&gt;/g, '<span style="color: $1;">')
    .replace(/&lt;\/span&gt;/g, '</span>')
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

function isUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''))
}

function getLikeIcon(active) {
  var path = active
    ? 'M544.814545 0a128.069818 128.069818 0 0 1 128.069819 128.069818v145.92h197.585454c112.197818 0 156.299636 137.378909 113.873455 387.211637l-3.653818 20.596363c-40.96 223.115636-102.679273 294.912-208.360728 295.633455H349.090909a116.363636 116.363636 0 0 1-116.363636-116.363637V467.781818c0-30.696727 11.333818-56.971636 30.370909-82.874182 5.213091-7.121455 19.083636-23.947636 17.594182-22.039272l8.285091-10.752c54.365091-72.238545 92.695273-153.972364 115.083636-245.597091A139.636364 139.636364 0 0 1 539.694545 0zM162.909091 372.363636a46.545455 46.545455 0 0 1 46.545454 46.545455v512a46.545455 46.545455 0 0 1-46.545454 46.545454A116.363636 116.363636 0 0 1 46.545455 861.090909V488.727273a116.363636 116.363636 0 0 1 116.363636-116.363637z'
    : 'M162.909091 372.363636a46.545455 46.545455 0 0 1 3.490909 92.974546L162.909091 465.454545a23.272727 23.272727 0 0 0-23.109818 20.549819L139.636364 488.727273v372.363636a23.272727 23.272727 0 0 0 23.272727 23.272727 46.545455 46.545455 0 1 1 0 93.090909 116.363636 116.363636 0 0 1-116.247273-111.313454L46.545455 861.090909V488.727273a116.363636 116.363636 0 0 1 116.363636-116.363637zM544.814545 0a128.069818 128.069818 0 0 1 128.069819 128.069818v145.92h197.585454c112.197818 0 156.299636 137.378909 113.873455 387.211637l-3.653818 20.596363c-40.96 223.115636-102.679273 294.912-208.360728 295.633455H349.090909a116.363636 116.363636 0 0 1-116.363636-116.363637V467.781818c0-30.696727 11.333818-56.971636 30.370909-82.874182 5.213091-7.121455 19.083636-23.947636 17.594182-22.039272l8.285091-10.752c54.365091-72.238545 92.695273-153.972364 115.083636-245.597091A139.636364 139.636364 0 0 1 539.694545 0z m0 93.090909h-5.12a46.545455 46.545455 0 0 0-45.218909 35.490909c-26.600727 108.986182-73.518545 206.382545-140.567272 291.770182 0-0.046545-2.141091 2.56-4.887273 5.957818l-10.914909 13.684364c-8.378182 11.403636-12.288 20.48-12.288 27.741091V861.090909a23.272727 23.272727 0 0 0 23.272727 23.272727h422.912c24.087273-0.162909 34.350545-3.793455 48.733091-20.968727 26.321455-31.464727 50.571636-97.629091 70.167273-208.221091 21.085091-118.993455 21.410909-202.542545 6.144-251.694545-8.797091-28.346182-18.013091-36.375273-26.577455-36.375273h-290.676363V128.069818c0-19.316364-15.639273-34.978909-34.955637-34.978909z'
  return '<svg class="action-icon like-icon ' + (active ? 'solid' : 'outline') + '" viewBox="0 0 1024 1024" aria-hidden="true"><path d="' + path + '" fill="currentColor"></path></svg>'
}

function getFavoriteIcon(active) {
  var path = 'M501.696 18.048c-45.632 3.84-86.848 32-107.84 73.984L311.744 258.752l-182.656 33.28c-48 6.4-89.28 41.344-105.6 90.176l-0.768 2.56-2.56 11.2a137.6 137.6 0 0 0 37.12 122.688l130.56 121.728-33.728 175.232c-9.728 48.64 10.88 100.864 51.392 131.328 23.04 16.96 50.368 25.92 78.464 25.792l12.8-0.64c16.896-1.6 33.472-6.528 48.448-14.528l166.976-82.88 167.04 83.584c19.328 9.664 40.576 15.104 60.672 15.104a125.44 125.44 0 0 0 79.36-27.712l8.128-6.72c33.92-30.4 50.304-76.8 41.728-122.688l-32.768-175.808 129.28-121.6 2.432-2.56c34.624-34.112 47.36-86.72 31.808-134.592l-3.072-9.344a130.048 130.048 0 0 0-102.912-82.112l-181.248-31.68-81.536-165.76C611.456 48.128 563.776 17.6 512.256 17.6L501.76 18.048z m10.56 92.352c15.04 0 29.248 9.088 34.752 21.568l103.232 209.92 228.928 40c15.936 2.304 27.904 12.8 32 26.944 5.12 16.064 1.28 32-9.472 42.688l-165.76 156.16 41.92 225.6a39.808 39.808 0 0 1-15.808 39.296 33.92 33.92 0 0 1-21.76 8 46.336 46.336 0 0 1-19.584-5.312l-208.32-104.192-209.6 103.936a39.68 39.68 0 0 1-18.944 4.928 38.272 38.272 0 0 1-22.912-7.424 41.408 41.408 0 0 1-15.744-39.04l43.52-225.92-166.784-155.456a43.52 43.52 0 0 1-11.2-35.392l1.344-6.72a38.848 38.848 0 0 1 31.488-26.304l230.848-41.984 102.592-208.448a40.704 40.704 0 0 1 35.264-22.848z'
  return '<span class="favorite-icon-wrap ' + (active ? 'solid' : 'outline') + '"><svg class="action-icon favorite-icon ' + (active ? 'solid' : 'outline') + '" viewBox="0 0 1024 1024" aria-hidden="true"><path d="' + path + '" fill="currentColor"></path></svg></span>'
}

function getActionIcon(type, active) {
  if (type === 'toggleLike') return getLikeIcon(active)
  if (type === 'toggleFavorite') return getFavoriteIcon(active)
  return ''
}

function renderActionButton(type, label, count, active) {
  var icon = getActionIcon(type, active)
  return [
    '<button class="action-btn ' + (active ? 'active' : '') + '" onclick="' + type + '()">',
    icon,
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
  var backgroundUrl = '/SiteProject/images/hero-bg.jpg'
  var coverUrl = article.cover_url || backgroundUrl
  shell.style.setProperty('--article-bg-image', "url('" + String(backgroundUrl).replace(/'/g, '%27') + "')")

  shell.innerHTML = [
    '<a href="/SiteProject/articles" class="back-link">返回文章列表</a>',
    '<div class="article-stage">',
    '  <main class="reader-card">',
    '    <div class="cover-frame">',
    '      <img src="' + escapeHtml(coverUrl) + '" class="detail-cover" alt="' + escapeHtml(article.title) + '">',
    '      <span>封面</span>',
    '    </div>',
    '    <header class="article-header">',
    '      <div class="title-row">',
    '        <span>标题</span>',
    '        <h1>' + escapeHtml(article.title) + '</h1>',
    '      </div>',
    '      <div class="author-row">',
    '        <img class="author-avatar" src="' + escapeHtml(authorAvatar) + '" alt="">',
    '        <div class="author-meta">',
    '          <strong>' + escapeHtml(authorName) + '</strong>',
    '          <span>' + formatDate(article.created_at) + '</span>',
    '        </div>',
    '        <span class="headline-pill">' + escapeHtml(getStatusText(article.status) || getVisibilityText(article.visibility)) + '</span>',
    '      </div>',
    article.tags && article.tags.length ? '      <div class="article-tags">' + article.tags.map(function(tag) { return '<a class="tag" href="/SiteProject/articles?tag=' + encodeURIComponent(tag) + '">' + escapeHtml(tag) + '</a>' }).join('') + '</div>' : '',
    '      <div class="article-kicker">',
    '        <span>' + escapeHtml(getVisibilityText(article.visibility)) + '</span>',
    '        <span>约 ' + getReadingMinutes(article.content) + ' 分钟阅读</span>',
    '      </div>',
    '    </header>',
    article.summary ? '    <section class="article-summary"><strong>摘要</strong><p>' + escapeHtml(article.summary) + '</p></section>' : '',
    '    <section class="article-body-card">',
    '      <div class="body-title">正文</div>',
    '      <div class="article-body">' + renderMarkdown(article.content || '') + '</div>',
    '    </section>',
    '    <section class="comment-section" id="comments">',
    '      <div class="section-title">',
    '        <h2>评论</h2>',
    '        <span>' + commentCount + ' 条讨论</span>',
    '      </div>',
    articleState.session ? [
    '      <div class="comment-editor">',
    '        <img class="comment-avatar" src="' + escapeHtml(getUserAvatar(articleState.session.user.id)) + '" alt="">',
    '        <textarea id="comment-input" placeholder="写下你的评论..."></textarea>',
    '        <button onclick="submitComment()">发布评论</button>',
    '      </div>'
    ].join('') : '      <div class="login-tip">登录后可以参与评论、点赞和收藏。</div>',
    '      <div id="comment-list" class="comment-list">' + renderComments() + '</div>',
    '    </section>',
    '  </main>',
    '  <aside class="floating-actions" aria-label="文章互动">',
    renderActionButton('toggleLike', '点赞', likeCount, articleState.liked),
    renderActionButton('scrollToTop', '浏览量', '阅读中', false),
    renderActionButton('toggleFavorite', favoriteLabel, articleState.favorited ? '已收藏' : '未收藏', articleState.favorited),
    '    <a class="action-link" href="#comments"><span class="action-label">评论数</span><strong>' + commentCount + '</strong></a>',
    articleState.favoriteTableReady ? '' : '      <p class="side-note">收藏表未创建，当前收藏仅保存在本机浏览器。</p>',
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
      .select('id, username, avatar_url')
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
  if (!session || !isUuid(session.user.id)) {
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

  if (!session || !isUuid(session.user.id) || !articleState.favoriteTableReady) {
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
  if (!session || !isUuid(session.user.id)) {
    alert('登录状态异常，请退出后重新使用 GitHub 登录')
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

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' })
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

    var result = await loadArticleRecord(supabase, articleState.id)

    if (result.error) throw new Error(result.error.message)
    if (!result.data) {
      setVisible('loading', false)
      setVisible('article-not-found', true)
      return
    }

    articleState.article = result.data
    saveRecentArticle(articleState.article)
    updateViewCountIfAvailable(supabase).catch(function(error) {
      console.warn('Article view count update skipped:', error)
    })
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
  window.scrollToTop = scrollToTop
}

if (typeof document !== 'undefined') {
  setTimeout(loadArticle, 100)
}
</script>

<style>
#article-page {
  max-width: none;
  margin: 0 calc(50% - 50vw);
  padding: 0;
  min-height: calc(100vh - 64px);
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
  position: fixed;
  z-index: 6;
  top: 86px;
  left: max(24px, calc(20vw + 16px));
  padding: 0.5rem 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.42);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.78);
  color: #1f2937;
  text-decoration: none;
  font-size: 0.85rem;
  backdrop-filter: blur(10px);
}

.article-stage {
  --article-content-width: min(60vw, 860px);
  position: relative;
  display: grid;
  grid-template-columns: minmax(0, 1fr) var(--article-content-width) minmax(0, 1fr);
  min-height: calc(100vh - 64px);
  padding: 24px 0 48px;
  background-image: linear-gradient(rgba(248, 250, 252, 0.58), rgba(248, 250, 252, 0.58)), url('/SiteProject/images/hero-bg.jpg');
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
  overflow: clip;
}

.reader-card {
  position: relative;
  z-index: 1;
  grid-column: 2;
  width: var(--article-content-width);
  min-height: calc(100vh - 88px);
  padding: 0 32px 56px;
  border: 1px solid rgba(226, 232, 240, 0.88);
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.92);
  box-shadow: 0 22px 60px rgba(15, 23, 42, 0.14);
  backdrop-filter: blur(16px);
}

.cover-frame {
  position: relative;
  height: 260px;
  margin: 0 -32px 0;
  overflow: hidden;
  border-radius: 16px 16px 0 0;
  border-bottom: 1px solid rgba(226, 232, 240, 0.9);
}

.detail-cover {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-frame span {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.72);
  color: rgba(51, 65, 85, 0.78);
  font-size: 0.84rem;
  letter-spacing: 0;
}

.article-header {
  padding: 18px 0 0;
}

.title-row {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr);
  gap: 18px;
  align-items: baseline;
  margin-bottom: 18px;
}

.title-row > span {
  font-weight: 700;
  color: var(--vp-c-text-1);
}

.title-row h1 {
  margin: 0;
  font-size: 1.65rem;
  line-height: 1.45;
  color: var(--vp-c-text-1);
  word-break: break-word;
}

.author-row {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 12px;
}

.author-avatar,
.comment-avatar {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  object-fit: cover;
  border: 3px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 8px 20px rgba(15, 23, 42, 0.14);
  background: #fff;
}

.author-meta {
  flex: 1;
  min-width: 0;
}

.author-meta strong {
  display: block;
  color: var(--vp-c-text-1);
  font-size: 0.95rem;
}

.author-meta span,
.comment-head span {
  display: block;
  color: #4b5563;
  font-size: 0.82rem;
}

.headline-pill {
  margin-left: auto;
  padding: 0.32rem 1rem;
  border: 1px solid rgba(148, 163, 184, 0.42);
  border-radius: 999px;
  background: rgba(248, 250, 252, 0.82);
  color: var(--vp-c-text-2);
  font-size: 0.85rem;
  white-space: nowrap;
}

.article-tags {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin: 8px 0 14px;
}

.tag {
  padding: 0.32rem 0.74rem;
  border: 1px solid rgba(59, 130, 246, 0.18);
  border-radius: 999px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  text-decoration: none;
  font-size: 0.88rem;
}

.article-kicker {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  color: #6b7280;
  font-size: 0.8rem;
}

.article-summary,
.article-body-card,
.comment-section {
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.78);
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.06);
}

.article-summary {
  margin: 24px 0 36px;
  padding: 16px 18px;
  min-height: 90px;
}

.article-summary strong,
.body-title {
  display: block;
  margin-bottom: 0.65rem;
  color: var(--vp-c-text-1);
  font-size: 0.95rem;
}

.article-summary p {
  margin: 0;
  color: var(--vp-c-text-2);
  line-height: 1.75;
}

.article-body-card {
  padding: 18px 22px 28px;
  min-height: 172px;
}

.article-body {
  color: var(--vp-c-text-1);
  line-height: 1.9;
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
  background: #f3f4f6;
}

.article-image {
  margin: 1.5rem 0;
}

.article-image img {
  display: block;
  width: 100%;
  max-height: 560px;
  object-fit: contain;
  border: 1px solid rgba(226, 232, 240, 0.95);
  border-radius: 12px;
  background: #f8fafc;
  box-shadow: 0 12px 30px rgba(15, 23, 42, 0.08);
}

.article-image figcaption {
  margin-top: 0.55rem;
  color: #64748b;
  font-size: 0.86rem;
  text-align: center;
}

.article-image figcaption:empty {
  display: none;
}

.floating-actions {
  position: fixed;
  z-index: 3;
  top: 236px;
  right: max(24px, calc(10vw - 48px));
  display: grid;
  gap: 0;
  width: 92px;
  overflow: hidden;
  border: 1px solid rgba(226, 232, 240, 0.92);
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.84);
  box-shadow: 0 18px 44px rgba(15, 23, 42, 0.14);
  backdrop-filter: blur(14px);
}

.action-btn,
.action-link {
  display: grid;
  gap: 0.28rem;
  justify-items: center;
  align-items: center;
  width: 100%;
  min-height: 82px;
  padding: 0.75rem 0.35rem;
  border: 0;
  border-bottom: 1px solid rgba(17, 24, 39, 0.16);
  background: transparent;
  color: var(--vp-c-text-1);
  text-decoration: none;
  cursor: pointer;
  font-size: 0.86rem;
}

.action-link {
  border-bottom: 0;
}

.action-btn.active {
  color: #d81e06;
  background: rgba(216, 30, 6, 0.08);
}

.action-icon {
  display: block;
  width: 15px;
  height: 15px;
  color: #434c4f;
  transition: color 0.18s ease, transform 0.18s ease;
}

.favorite-icon-wrap {
  position: relative;
  display: block;
  width: 15px;
  height: 15px;
}

.favorite-icon {
  color: #d81e06;
}

.favorite-icon-wrap.solid::before {
  position: absolute;
  inset: 3px;
  content: '';
  border-radius: 999px;
  background: #d81e06;
}

.favorite-icon-wrap .favorite-icon {
  position: relative;
  z-index: 1;
}

.action-btn.active .like-icon {
  color: #d81e06;
}

.action-btn.active .favorite-icon {
  color: #d81e06;
}

.action-btn.active .action-icon {
  transform: scale(1.04);
}

.action-label {
  font-size: 0.86rem;
}

.action-btn strong,
.action-link strong {
  font-size: 0.78rem;
  font-weight: 600;
  color: inherit;
}

.side-note {
  margin: 0;
  padding: 0.55rem;
  color: #6b7280;
  font-size: 0.72rem;
  line-height: 1.5;
  border-top: 1px solid rgba(17, 24, 39, 0.16);
}

.comment-section {
  margin-top: 34px;
  padding: 16px;
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
  color: #111827;
  font-size: 1rem;
}

.section-title span {
  color: #6b7280;
  font-size: 0.85rem;
}

.comment-editor {
  display: grid;
  grid-template-columns: 38px minmax(0, 1fr) auto;
  gap: 0.65rem;
  align-items: center;
  margin-bottom: 1.25rem;
}

.comment-editor .comment-avatar {
  width: 38px;
  height: 38px;
}

.comment-editor textarea {
  min-height: 34px;
  height: 34px;
  resize: none;
  padding: 0.42rem 0.7rem;
  border: 1px solid rgba(203, 213, 225, 0.92);
  border-radius: 8px;
  background: #fff;
  color: var(--vp-c-text-1);
}

.comment-editor button {
  padding: 0.48rem 0.8rem;
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 8px;
  background: var(--vp-c-brand-1);
  color: #fff;
  cursor: pointer;
  white-space: nowrap;
}

.login-tip,
.empty-comments {
  padding: 1rem;
  border-radius: 8px;
  background: #f3f4f6;
  color: #4b5563;
}

.comment-list {
  display: grid;
  gap: 1rem;
}

.comment-item {
  display: grid;
  grid-template-columns: 54px minmax(0, 1fr);
  gap: 1rem;
  align-items: flex-start;
  padding-top: 1rem;
  border-top: 1px solid rgba(17, 24, 39, 0.12);
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

.comment-head strong {
  color: var(--vp-c-text-1);
}

.comment-main p {
  margin: 0.35rem 0 0;
  padding: 0.85rem 1rem;
  border: 1px solid rgba(226, 232, 240, 0.92);
  border-radius: 12px;
  background: rgba(248, 250, 252, 0.78);
  color: var(--vp-c-text-1);
  line-height: 1.7;
}

@media (max-width: 1080px) {
  .back-link {
    left: 1rem;
  }

  .article-stage {
    grid-template-columns: minmax(0, 1fr);
    padding: 12px 1rem 84px;
  }

  .reader-card {
    grid-column: 1;
    width: min(100%, 760px);
    margin: 0 auto;
  }

  .floating-actions {
    top: auto;
    right: 1rem;
    bottom: 1rem;
    left: 1rem;
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    width: auto;
    border-radius: 14px;
  }

  .action-btn,
  .action-link {
    min-height: 58px;
    border-right: 1px solid rgba(17, 24, 39, 0.16);
    border-bottom: 0;
  }

  .action-icon {
    width: 14px;
    height: 14px;
  }

  .favorite-icon-wrap {
    width: 14px;
    height: 14px;
  }

  .action-link {
    border-right: 0;
  }
}

@media (max-width: 560px) {
  .reader-card {
    padding: 0 16px 38px;
    border-radius: 18px;
  }

  .cover-frame {
    height: 172px;
    margin: 0 -16px;
    border-radius: 16px 16px 14px 14px;
  }

  .title-row {
    grid-template-columns: 44px minmax(0, 1fr);
    gap: 12px;
  }

  .author-row {
    flex-wrap: wrap;
  }

  .headline-pill {
    margin-left: 0;
  }

  .comment-editor {
    grid-template-columns: 38px minmax(0, 1fr);
  }

  .comment-editor button {
    grid-column: 2;
    justify-self: end;
  }
}
</style>
