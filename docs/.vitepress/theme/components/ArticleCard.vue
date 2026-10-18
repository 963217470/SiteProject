<template>
  <article class="rd-article" :class="{ 'rd-article-discussion': discussion }">
    <a :href="href" class="rd-article-cover rd-article-first-image" tabindex="-1" aria-hidden="true"><img :src="cover" alt="" loading="lazy" @error="cover = DEFAULT_ARTICLE_COVER"></a>
    <div class="rd-article-content">
      <div class="rd-article-meta"><img v-if="discussion && avatar" class="discussion-avatar" :src="avatar" alt="" loading="lazy" @error="avatar=''"><span v-else-if="discussion" class="discussion-avatar" aria-hidden="true">{{ (article.profiles?.username || 'RD').slice(0,1) }}</span><div class="discussion-author"><span>{{ article.profiles?.username || 'RD STUDIO' }}</span><time :datetime="article.created_at">{{ date }}</time></div><span v-if="article.visibility === 'internal'"><LockKeyhole :size="12" aria-hidden="true" />内部</span></div>
      <h2><a :href="href">{{ article.title }}</a></h2>
      <p v-if="summary" class="rd-article-summary">{{ summary }}</p>
      <div class="rd-article-bottom"><div class="rd-tags"><button v-for="tag in topicTags.slice(0, 3)" :key="tag" type="button" :aria-label="'筛选标签 ' + tag" @click="$emit('tag', tag)">{{ tag }}</button></div><div class="rd-article-trailing"><div v-if="badges.length" class="article-badges" aria-label="文章标记"><span v-for="badge in badges" :key="badge.kind" class="article-badge" :class="'article-badge-'+badge.kind">{{ badge.label }}</span></div><div class="rd-article-counts"><span :aria-label="(article.likes_count || 0) + ' 个赞'"><Heart :size="14" aria-hidden="true" />{{ article.likes_count || 0 }}</span><span :aria-label="(article.comments_count || 0) + ' 条评论'"><MessageCircle :size="14" aria-hidden="true" />{{ article.comments_count || 0 }}</span></div></div></div>
    </div>
  </article>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { Heart, LockKeyhole, MessageCircle } from 'lucide-vue-next'
import { articleBadges, articleTopicTags } from '../lib/article-badges.mjs'
import { articleCover, DEFAULT_ARTICLE_COVER } from '../lib/article-cover.mjs'
const props = defineProps({ article: { type: Object, required: true }, discussion: Boolean })
const badges = computed(() => articleBadges(props.article))
const topicTags = computed(() => articleTopicTags(props.article.tags))
defineEmits(['tag'])
const cover = ref('')
const avatar = ref('')
watch(() => props.article.profiles?.avatar_url, value => { avatar.value=value || '' }, { immediate: true })
watch(() => [props.article.first_image_url, props.article.content], () => { cover.value = articleCover(props.article) }, { immediate: true })
const href = computed(() => '/article?id=' + encodeURIComponent(props.article.id))
const date = computed(() => props.article.created_at ? new Date(props.article.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) : '')
const summary = computed(() => String(props.article.summary || props.article.content || '').replace(/<[^>]*>/g, '').replace(/!\[[^\]]*\]\([^)]+\)/g, '').replace(/[#*_`>]/g, '').slice(0, 180))
</script>

<style scoped>
body #app .rd-article.rd-article-discussion { display:grid; grid-template-columns:196px minmax(0,1fr); align-items:start; }
body #app .rd-article .rd-article-first-image { width:100%; aspect-ratio:4/3; margin:0; background:var(--vp-c-bg-soft); }
body #app .rd-article .rd-article-first-image img { display:block; width:100%; height:100%; object-fit:contain; transform:none; }
body #app .rd-article-grid .rd-article.rd-article-discussion { grid-template-columns:minmax(0,1fr); }
@media(max-width:600px) { body #app .rd-article.rd-article-discussion { grid-template-columns:100px minmax(0,1fr); gap:14px; padding:16px; } }
@media(max-width:420px) { body #app .rd-article.rd-article-discussion { grid-template-columns:minmax(0,1fr); } body #app .rd-article .rd-article-first-image { max-height:220px; } }
body #app .rd-article-feed:not(.rd-article-grid) .rd-article.rd-article-discussion { grid-template-columns:minmax(0,38%) minmax(0,1fr); align-items:stretch; }
body #app .rd-article-feed:not(.rd-article-grid) .rd-article .rd-article-first-image { position:relative; aspect-ratio:auto; min-height:260px; max-height:none; }
body #app .rd-article-feed:not(.rd-article-grid) .rd-article .rd-article-first-image img { position:absolute; inset:0; }
@media(max-width:600px) {
  body #app .rd-article-feed:not(.rd-article-grid) .rd-article.rd-article-discussion { grid-template-columns:minmax(0,1fr); }
  body #app .rd-article-feed:not(.rd-article-grid) .rd-article .rd-article-first-image { aspect-ratio:4/3; min-height:0; }
}
</style>
