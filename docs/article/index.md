---
title: 文章详情
layout: page
---

<div id="article-page">
  <div id="loading" class="loading">
    <p>加载中...</p>
    <p class="loading-hint">如果长时间没有响应，请检查浏览器控制台</p>
  </div>

  <div id="error" class="error" style="display:none">
    <p id="error-message">加载失败</p>
    <p><a href="/SiteProject/articles">返回文章列表</a></p>
  </div>

  <div id="article-not-found" class="not-found" style="display:none">
    <p>文章不存在</p>
    <p><a href="/SiteProject/articles">返回文章列表</a></p>
  </div>

  <div id="article-content" style="display:none">
  </div>
</div>

<script>
let currentArticleData = null

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

function getVisibilityText(v) {
  return { public: '🌐 公开', internal: '🔒 内部' }[v] || v
}

function getStatusText(s) {
  return { draft: '📝 草稿', pending: '⏳ 待审核', published: '✅ 已发布', rejected: '❌ 已拒绝' }[s] || s
}

function renderMarkdown(content) {
  if (!content) return ''
  
  let html = content
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>')
  
  return '<p>' + html + '</p>'
}

async function waitForSupabase(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    if (typeof window !== 'undefined' && window.__supabase) {
      console.log('Supabase loaded after', i * 100, 'ms')
      return true
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  return false
}

async function loadArticle() {
  if (typeof document === 'undefined') return
  const loading = document.getElementById('loading')
  const error = document.getElementById('error')
  const errorMessage = document.getElementById('error-message')
  const notFound = document.getElementById('article-not-found')
  const contentDiv = document.getElementById('article-content')

  loading.style.display = 'block'
  error.style.display = 'none'
  notFound.style.display = 'none'
  contentDiv.style.display = 'none'

  try {
    console.log('Starting loadArticle...')

    const urlParams = new URLSearchParams(window.location.search)
    const articleId = urlParams.get('id')
    console.log('Article ID:', articleId)

    if (!articleId) {
      loading.style.display = 'none'
      notFound.style.display = 'block'
      return
    }

    console.log('Waiting for Supabase...')
    const hasSupabase = await waitForSupabase()
    
    if (!hasSupabase) {
      loading.style.display = 'none'
      error.style.display = 'block'
      errorMessage.textContent = 'Supabase 未加载，请刷新页面重试'
      return
    }

    const supabase = window.__supabase
    console.log('Fetching article...')

    const { data, error: queryError } = await supabase
      .from('articles')
      .select('id, title, summary, content, cover_url, tags, visibility, status, created_at, likes_count, comments_count')
      .eq('id', articleId)
      .single()

    console.log('Query result:', { data, queryError })

    if (queryError) {
      throw new Error('查询失败: ' + queryError.message)
    }

    if (!data) {
      loading.style.display = 'none'
      notFound.style.display = 'block'
      return
    }

    loading.style.display = 'none'
    currentArticleData = data
    document.title = data.title + ' | 网站'

    contentDiv.style.display = 'block'
    contentDiv.innerHTML = `
      <div class="article-header">
        <a href="/SiteProject/articles" class="back-link">← 返回文章列表</a>
        ${data.cover_url ? `<img src="${data.cover_url}" class="article-cover" alt="${data.title}" onerror="this.style.display='none'">` : ''}
        <h1>${data.title}</h1>
        <div class="article-meta">
          <span class="meta-item">📅 ${formatDate(data.created_at)}</span>
          <span class="meta-item">${getVisibilityText(data.visibility)}</span>
          <span class="meta-item">${getStatusText(data.status)}</span>
          <span class="meta-item">❤️ ${data.likes_count || 0} 喜欢</span>
          <span class="meta-item">💬 ${data.comments_count || 0} 评论</span>
        </div>
        ${data.tags && data.tags.length > 0 ? `
          <div class="article-tags">
            ${data.tags.map(tag => `<span class="tag">#${tag}</span>`).join('')}
          </div>
        ` : ''}
      </div>

      ${data.summary ? `<div class="article-summary">${data.summary}</div>` : ''}

      <div class="article-body">
        ${renderMarkdown(data.content || '')}
      </div>

      <div class="article-footer">
        <button id="like-btn" class="like-btn">❤️ 喜欢这篇文章</button>
      </div>
    `

    const likeBtn = document.getElementById('like-btn')
    likeBtn.addEventListener('click', () => likeArticle(data.id, data.likes_count))

  } catch (e) {
    console.error('Load article error:', e)
    loading.style.display = 'none'
    error.style.display = 'block'
    errorMessage.textContent = '加载失败: ' + e.message
  }
}

async function likeArticle(articleId, currentLikes) {
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

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      alert('请先登录')
      return
    }

    const { error } = await supabase
      .from('article_likes')
      .insert({ article_id: articleId, user_id: session.user.id })

    if (error && !error.message.includes('duplicate')) {
      alert('点赞失败')
      return
    }

    if (!error) {
      await supabase
        .from('articles')
        .update({ likes_count: (currentLikes || 0) + 1 })
        .eq('id', articleId)
    }

    alert('点赞成功！')
    window.location.reload()

  } catch (e) {
    console.error('Like article error:', e)
  }
}

if (typeof document !== 'undefined') {
  setTimeout(() => {
    loadArticle()
  }, 100)
}
</script>

<style>
#article-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.loading, .error, .not-found {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--vp-c-text-2);
}

.loading-hint {
  font-size: 0.85rem;
  color: var(--vp-c-text-3);
  margin-top: 0.5rem;
}

.error p:first-child {
  color: #dc2626;
  font-weight: 500;
}

.back-link {
  display: inline-block;
  margin-bottom: 1.5rem;
  color: var(--vp-c-brand-1);
  text-decoration: none;
}

.back-link:hover {
  text-decoration: underline;
}

.article-cover {
  width: 100%;
  max-height: 400px;
  object-fit: cover;
  border-radius: 12px;
  margin-bottom: 1.5rem;
}

.article-header h1 {
  font-size: 2rem;
  margin-bottom: 1rem;
}

.article-meta {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 1rem;
  font-size: 0.9rem;
  color: var(--vp-c-text-3);
}

.article-tags {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  margin-bottom: 2rem;
}

.tag {
  padding: 0.3rem 0.6rem;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  border-radius: 4px;
  font-size: 0.85rem;
}

.article-summary {
  padding: 1rem 1.5rem;
  background: var(--vp-c-bg-soft);
  border-left: 4px solid var(--vp-c-brand-1);
  border-radius: 0 8px 8px 0;
  margin-bottom: 2rem;
  font-size: 1.05rem;
  line-height: 1.7;
}

.article-body {
  font-size: 1.05rem;
  line-height: 1.8;
  color: var(--vp-c-text-1);
}

.article-body h1, .article-body h2, .article-body h3 {
  margin: 1.5rem 0 0.75rem 0;
}

.article-body h1 { font-size: 1.75rem; }
.article-body h2 { font-size: 1.5rem; }
.article-body h3 { font-size: 1.25rem; }

.article-body p {
  margin: 0 0 1rem 0;
}

.article-body code {
  padding: 0.2rem 0.4rem;
  background: var(--vp-c-bg-soft);
  border-radius: 4px;
  font-family: monospace;
  font-size: 0.95rem;
}

.article-footer {
  margin-top: 3rem;
  padding-top: 2rem;
  border-top: 1px solid var(--vp-c-divider);
  text-align: center;
}

.like-btn {
  padding: 0.75rem 2rem;
  font-size: 1rem;
  background: var(--vp-c-brand-1);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.like-btn:hover {
  background: var(--vp-c-brand-2);
  transform: scale(1.05);
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
