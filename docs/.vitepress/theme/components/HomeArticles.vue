<template>
  <div class="home-articles" v-if="latestArticles.length > 0">
    <h2>📝 最新文章</h2>
    <div class="article-list">
      <a v-for="a in latestArticles" :key="a.id" :href="'/article?id=' + a.id" class="article-card">
        <div class="article-cover">
          <img :src="a.cover_url || '/images/default-cover.svg'" :alt="a.title">
        </div>
        <div class="article-info">
          <h3>{{ a.title }}</h3>
          <p v-if="a.summary" class="article-summary">{{ a.summary }}</p>
          <div class="article-meta">
            <span class="author">{{ a.profiles?.username || '未知' }}</span>
            <span class="date">{{ formatDate(a.created_at) }}</span>
          </div>
          <div v-if="a.tags && a.tags.length > 0" class="article-tags">
            <span v-for="t in a.tags" :key="t" class="tag">{{ t }}</span>
          </div>
        </div>
      </a>
    </div>
    <div class="view-more">
      <a href="/articles" class="btn-primary">查看更多文章 →</a>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const latestArticles = ref([])

function formatDate(d) { return new Date(d).toLocaleDateString('zh-CN') }

onMounted(async () => {
  try {
    if (!window.__supabase) return
    const supabase = window.__supabase
    const { data } = await supabase
      .from('articles')
      .select('id, title, summary, cover_url, tags, created_at, profiles!articles_author_id_fkey(username)')
      .eq('status', 'published')
      .eq('visibility', 'public')
      .order('created_at', { ascending: false })
      .limit(3)
    latestArticles.value = data || []
  } catch (e) { console.error('Home articles load error:', e) }
})
</script>

<style scoped>
.home-articles {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
}
.home-articles h2 {
  margin: 0 0 1.5rem 0;
  font-size: 1.5rem;
  text-align: center;
}
.article-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.article-card {
  display: flex;
  gap: 1.25rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  padding: 1.25rem;
  text-decoration: none;
  color: inherit;
  transition: all 0.2s;
}
.article-card:hover {
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}
.article-cover {
  flex-shrink: 0;
  width: 180px;
  height: 110px;
  border-radius: 6px;
  overflow: hidden;
}
.article-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.article-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.article-info h3 {
  margin: 0 0 0.4rem 0;
  font-size: 1.15rem;
  color: var(--vp-c-text-1);
}
.article-summary {
  color: var(--vp-c-text-2);
  font-size: 0.85rem;
  margin: 0 0 0.5rem 0;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.article-meta {
  display: flex;
  gap: 1rem;
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
  margin-bottom: 0.5rem;
}
.author {
  font-weight: 500;
  color: var(--vp-c-text-1);
}
.article-tags {
  display: flex;
  gap: 0.4rem;
  margin-top: auto;
  flex-wrap: wrap;
}
.tag {
  padding: 0.15rem 0.5rem;
  background: var(--vp-c-bg-soft);
  border-radius: 4px;
  font-size: 0.75rem;
  color: var(--vp-c-text-2);
}
.view-more {
  text-align: center;
  margin-top: 2rem;
}
.btn-primary {
  color: white;
}
</style>
