<template>
  <article class="rd-article" :class="{ 'rd-article-discussion': discussion }">
    <a v-if="!discussion" :href="href" class="rd-article-cover" tabindex="-1" aria-hidden="true"><img :src="cover" alt="" loading="lazy" @error="cover = '/images/default-cover.svg'"></a>
    <div class="rd-article-content">
      <div class="rd-article-meta"><img v-if="discussion && avatar" class="discussion-avatar" :src="avatar" alt="" loading="lazy" @error="avatar=''"><span v-else-if="discussion" class="discussion-avatar" aria-hidden="true">{{ (article.profiles?.username || 'RD').slice(0,1) }}</span><div class="discussion-author"><span>{{ article.profiles?.username || 'RD STUDIO' }}</span><time :datetime="article.created_at">{{ date }}</time></div><span v-if="article.visibility === 'internal'"><LockKeyhole :size="12" aria-hidden="true" />内部</span></div>
      <h2><a :href="href">{{ article.title }}</a></h2>
      <p v-if="summary" class="rd-article-summary">{{ summary }}</p>
      <a v-if="discussion && article.cover_url" :href="href" class="rd-article-cover" tabindex="-1" aria-hidden="true"><img :src="cover" alt="" loading="lazy" @error="cover='/images/default-cover.svg'"></a>
      <div class="rd-article-bottom"><div class="rd-tags"><button v-for="tag in topicTags.slice(0, 3)" :key="tag" type="button" :aria-label="'筛选标签 ' + tag" @click="$emit('tag', tag)">{{ tag }}</button></div><div class="rd-article-trailing"><div v-if="badges.length" class="article-badges" aria-label="文章标记"><span v-for="badge in badges" :key="badge.kind" class="article-badge" :class="'article-badge-'+badge.kind">{{ badge.label }}</span></div><div class="rd-article-counts"><span :aria-label="(article.likes_count || 0) + ' 个赞'"><Heart :size="14" aria-hidden="true" />{{ article.likes_count || 0 }}</span><span :aria-label="(article.comments_count || 0) + ' 条评论'"><MessageCircle :size="14" aria-hidden="true" />{{ article.comments_count || 0 }}</span></div></div></div>
    </div>
  </article>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { Heart, LockKeyhole, MessageCircle } from 'lucide-vue-next'
import { articleBadges, articleTopicTags } from '../lib/article-badges.mjs'
const props = defineProps({ article: { type: Object, required: true }, discussion: Boolean })
const badges = computed(() => articleBadges(props.article))
const topicTags = computed(() => articleTopicTags(props.article.tags))
defineEmits(['tag'])
const cover = ref('')
const avatar = ref('')
watch(() => props.article.profiles?.avatar_url, value => { avatar.value=value || '' }, { immediate: true })
watch(() => props.article.cover_url, value => { cover.value = value || '/images/default-cover.svg' }, { immediate: true })
const href = computed(() => '/article?id=' + encodeURIComponent(props.article.id))
const date = computed(() => props.article.created_at ? new Date(props.article.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) : '')
const summary = computed(() => String(props.article.summary || props.article.content || '').replace(/<[^>]*>/g, '').replace(/!\[[^\]]*\]\([^)]+\)/g, '').replace(/[#*_`>]/g, '').slice(0, 180))
</script>
