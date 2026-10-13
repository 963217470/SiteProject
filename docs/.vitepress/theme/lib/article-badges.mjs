export const productionTags = ['视频转文', '手搓']

export function productionTag(tags) {
  const sources = productionTags.filter(tag => Array.isArray(tags) && tags.includes(tag))
  return sources.length === 1 ? sources[0] : ''
}

export function withProductionTag(tags, source) {
  const topics = (Array.isArray(tags) ? tags : []).filter(tag => !productionTags.includes(tag))
  return productionTags.includes(source) ? [...topics, source] : topics
}

export function articleBadges(article) {
  const badges = []
  if (article.kb_enabled === true && article.status === 'published') badges.push({ label: '知识库', kind: 'knowledge' })
  const source = productionTag(article.tags)
  if (source) badges.push({ label: source, kind: source === '视频转文' ? 'video' : 'manual' })
  return badges
}

export function articleTopicTags(tags) {
  return (Array.isArray(tags) ? tags : []).filter(tag => tag !== '知识库' && !productionTags.includes(tag))
}
