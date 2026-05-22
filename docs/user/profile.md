---
title: 我的主页
layout: page
---

<script setup>
import { ref, reactive, onMounted } from 'vue'

const user = reactive({
  username: '',
  avatar: '/SiteProject/images/default-avatar.svg',
  bio: '',
  role: '',
  articleCount: 0,
  likes: 0,
  comments: 0
})

const userArticles = reactive([])
const loading = ref(true)
const notLoggedIn = ref(false)

onMounted(async () => {
  try {
    if (typeof window === 'undefined' || !window.__supabase) { loading.value = false; return }
    const client = window.__supabase

    const { data: { session } } = await client.auth.getSession()

    if (!session) {
      notLoggedIn.value = true
      loading.value = false
      return
    }

    const uid = session.user.id
    const meta = session.user.user_metadata || {}

    console.log('用户数据:', session.user)
    console.log('用户元数据:', meta)

    const { data: profile } = await client
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .single()

    if (profile) {
      user.username = profile.username || ''
      if (!user.username) {
        if (meta.full_name) user.username = meta.full_name
        else if (meta.user_name) user.username = meta.user_name
        else if (meta.name) user.username = meta.name
        else if (meta.preferred_username) user.username = meta.preferred_username
        else user.username = session.user.email
      }
      
      user.avatar = profile.avatar_url || 
                   meta.avatar_url || 
                   meta.picture || 
                   '/SiteProject/images/default-avatar.svg'
      
      user.bio = profile.bio || ''
      user.role = profile.role || 'member'
    } else {
      if (meta.full_name) user.username = meta.full_name
      else if (meta.user_name) user.username = meta.user_name
      else if (meta.name) user.username = meta.name
      else if (meta.preferred_username) user.username = meta.preferred_username
      else user.username = session.user.email
      
      user.avatar = meta.avatar_url || meta.picture || '/SiteProject/images/default-avatar.svg'
      user.role = 'member'
    }

    const { data: articles } = await client
      .from('articles')
      .select('id, title, created_at, likes_count, comments_count, summary, cover_url')
      .eq('author_id', uid)
      .eq('status', 'published')
      .order('created_at', { ascending: false })

    if (articles) {
      userArticles.push(...articles)
      user.articleCount = articles.length
    }

    const { count: likeCount } = await client
      .from('article_likes')
      .select('*', { count: 'exact', head: true })
      .in('article_id', userArticles.map(a => a.id))
    user.likes = likeCount || 0

    const { count: commentCount } = await client
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .in('article_id', userArticles.map(a => a.id))
    user.comments = commentCount || 0

  } catch (e) {
    console.error('Profile load error:', e)
  } finally {
    loading.value = false
  }
})

function handleCoverError(e) { e.target.src = '/SiteProject/images/default-cover.svg' }
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('zh-CN')
}
function isAdminRole(role) {
  return role === 'admin'
}
function getRoleText(role) {
  return isAdminRole(role) ? '管理员' : '社员'
}
function getRoleDescription(role) {
  return isAdminRole(role) ? '拥有文章审核与后台管理权限' : '可发布文章并参与社团内容'
}
</script>

<div class="profile-root">
  <div v-show="notLoggedIn" class="not-logged-in">
    <p>请先 <a href="/SiteProject/login">登录</a></p>
  </div>

  <div v-show="loading && !notLoggedIn" class="loading-state">
    <p>加载中...</p>
  </div>

  <div v-show="!loading && !notLoggedIn" class="profile-layout">
    <aside class="profile-sidebar">
      <div class="profile-card">
        <div class="profile-identity">
          <div class="avatar-frame" :class="isAdminRole(user.role) ? 'admin-frame' : 'member-frame'">
            <img :src="user.avatar" :alt="user.username" class="user-avatar">
          </div>
          <h2 class="username">{{ user.username }}</h2>
          <div class="role-block" :class="isAdminRole(user.role) ? 'admin-role' : 'member-role'">
            <span class="role-label">{{ getRoleText(user.role) }}</span>
            <span class="role-desc">{{ getRoleDescription(user.role) }}</span>
          </div>
        </div>
        <p class="user-bio">{{ user.bio || '这个人很懒，什么都没写' }}</p>
        <div class="user-stats">
          <div class="stat-item">
            <div class="stat-value">{{ user.articleCount }}</div>
            <div class="stat-label">文章</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ user.likes }}</div>
            <div class="stat-label">点赞</div>
          </div>
          <div class="stat-item">
            <div class="stat-value">{{ user.comments }}</div>
            <div class="stat-label">评论</div>
          </div>
        </div>
        <a href="/SiteProject/user/settings" class="edit-profile-btn">编辑资料</a>
      </div>
    </aside>
    <main class="profile-main">
      <h2>📝 已发布的文章</h2>
      <div v-if="userArticles.length === 0" class="no-articles"><p>暂无文章</p></div>
      <div v-else class="article-list">
        <a v-for="article in userArticles" :key="article.id" :href="'/SiteProject/article?id=' + article.id" class="article-card">
          <div v-if="article.cover_url" class="article-cover"><img :src="article.cover_url" :alt="article.title" @error="handleCoverError"></div>
          <div class="article-body">
            <h3>{{ article.title }}</h3>
            <p v-if="article.summary" class="article-summary">{{ article.summary }}</p>
            <div class="article-meta">
              <span>{{ formatDate(article.created_at) }}</span>
              <span>❤️ {{ article.likes_count || 0 }}</span>
              <span>💬 {{ article.comments_count || 0 }}</span>
            </div>
          </div>
        </a>
      </div>
    </main>
  </div>
</div>

<style scoped>
.not-logged-in, .loading-state { text-align: center; padding: 4rem 2rem; color: var(--vp-c-text-2); }
.not-logged-in a { color: var(--vp-c-brand-1); }
.profile-layout { display: flex; gap: 2rem; max-width: 1100px; margin: 0 auto; padding: 2rem; align-items: flex-start; }
.profile-sidebar { flex: 0 0 300px; position: sticky; top: 80px; }
.profile-card { display: flex; flex-direction: column; align-items: center; padding: 2rem; background: var(--vp-c-bg-soft); border: 1px solid var(--vp-c-divider); border-radius: 12px; text-align: center; }
.profile-identity { display: flex; flex-direction: column; align-items: center; width: 100%; }
.avatar-frame { display: grid; place-items: center; width: 118px; height: 118px; margin: 0 auto 1rem; border-radius: 999px; }
.avatar-frame.member-frame { background: linear-gradient(135deg, rgba(59, 130, 246, 0.18), rgba(34, 197, 94, 0.14)); }
.avatar-frame.admin-frame { background: linear-gradient(135deg, rgba(245, 158, 11, 0.28), rgba(220, 38, 38, 0.12)); }
.user-avatar { display: block; width: 104px; height: 104px; border-radius: 50%; object-fit: cover; border: 4px solid var(--vp-c-bg); box-shadow: 0 6px 18px rgba(0, 0, 0, 0.12); }
.username { margin: 0 0 0.75rem 0; font-size: 1.25rem; line-height: 1.35; word-break: break-word; }
.role-block { display: grid; gap: 0.25rem; width: 100%; margin-bottom: 1rem; padding: 0.75rem 0.9rem; border: 1px solid var(--vp-c-divider); border-radius: 8px; }
.role-block.admin-role { background: rgba(245, 158, 11, 0.12); border-color: rgba(245, 158, 11, 0.45); color: #92400e; }
.role-block.member-role { background: rgba(59, 130, 246, 0.1); border-color: rgba(59, 130, 246, 0.35); color: #1d4ed8; }
.role-label { font-size: 0.9rem; font-weight: 700; }
.role-desc { font-size: 0.75rem; line-height: 1.4; opacity: 0.86; }
.user-bio { width: 100%; margin: 0 0 1.5rem 0; font-size: 0.875rem; color: var(--vp-c-text-2); line-height: 1.5; }
.user-stats { display: flex; justify-content: center; gap: 1.5rem; margin-bottom: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--vp-c-divider); }
.stat-item { text-align: center; }
.stat-value { font-size: 1.25rem; font-weight: 700; color: var(--vp-c-brand-1); }
.stat-label { font-size: 0.75rem; color: var(--vp-c-text-2); }
.edit-profile-btn { display: block; width: 100%; padding: 0.6rem; text-align: center; border: 1px solid var(--vp-c-brand-1); color: var(--vp-c-brand-1); border-radius: 8px; text-decoration: none; font-size: 0.875rem; transition: all 0.2s; }
.edit-profile-btn:hover { background: var(--vp-c-brand-1); color: white; }
.profile-main { flex: 1; min-width: 0; }
.profile-main h2 { margin: 0 0 1.5rem 0; font-size: 1.25rem; }
.article-list { display: flex; flex-direction: column; gap: 1rem; }
.article-card { display: flex; gap: 1rem; padding: 1.25rem; border: 1px solid var(--vp-c-divider); border-radius: 8px; transition: all 0.2s; text-decoration: none; color: inherit; }
.article-card:hover { border-color: var(--vp-c-brand-1); box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
.article-cover { flex-shrink: 0; width: 160px; height: 100px; border-radius: 6px; overflow: hidden; }
.article-cover img { width: 100%; height: 100%; object-fit: cover; }
.article-body { flex: 1; min-width: 0; display: flex; flex-direction: column; }
.article-body h3 { margin: 0 0 0.5rem 0; font-size: 1.1rem; }
.article-summary { margin: 0 0 0.5rem 0; font-size: 0.85rem; color: var(--vp-c-text-2); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.article-meta { margin-top: auto; display: flex; gap: 1rem; font-size: 0.8rem; color: var(--vp-c-text-2); }
.no-articles { text-align: center; padding: 3rem; color: var(--vp-c-text-2); background: var(--vp-c-bg-soft); border-radius: 8px; }
@media (max-width: 768px) { .profile-layout { flex-direction: column; padding: 1rem; } .profile-sidebar { flex: none; position: static; width: 100%; } .profile-card { padding: 1.5rem; } .article-cover { width: 120px; height: 80px; } }
</style>
