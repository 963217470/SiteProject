<template>
  <article class="rd-article">
    <a :href="href" class="rd-article-cover" tabindex="-1" aria-hidden="true"><img :src="cover" alt="" loading="lazy" @error="cover = '/images/default-cover.svg'"></a>
    <div class="rd-article-content">
      <div class="rd-article-meta"><span>{{ article.profiles?.username || 'RD STUDIO' }}</span><span>{{ date }}</span><span v-if="article.visibility === 'internal'"><LockKeyhole :size="12" aria-hidden="true" />内部</span></div>
      <h2><a :href="href">{{ article.title }}</a></h2>
      <p v-if="summary" class="rd-article-summary">{{ summary }}</p>
      <div class="rd-article-bottom"><div class="rd-tags"><button v-for="tag in (article.tags || []).slice(0, 3)" :key="tag" type="button" :aria-label="'筛选标签 ' + tag" @click="$emit('tag', tag)">{{ tag }}</button></div><div class="rd-article-counts"><span :aria-label="(article.likes_count || 0) + ' 个赞'"><Heart :size="14" aria-hidden="true" />{{ article.likes_count || 0 }}</span><span :aria-label="(article.comments_count || 0) + ' 条评论'"><MessageCircle :size="14" aria-hidden="true" />{{ article.comments_count || 0 }}</span></div></div>
    </div>
  </article>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { Heart, LockKeyhole, MessageCircle } from 'lucide-vue-next'
const props = defineProps({ article: { type: Object, required: true } })
defineEmits(['tag'])
const cover = ref('')
watch(() => props.article.cover_url, value => { cover.value = value || '/images/default-cover.svg' }, { immediate: true })
const href = computed(() => '/article?id=' + encodeURIComponent(props.article.id))
const date = computed(() => props.article.created_at ? new Date(props.article.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }) : '')
const summary = computed(() => String(props.article.summary || props.article.content || '').replace(/<[^>]*>/g, '').replace(/!\[[^\]]*\]\([^)]+\)/g, '').replace(/[#*_`>]/g, '').slice(0, 180))
</script>
