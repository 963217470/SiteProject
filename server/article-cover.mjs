import { fromMarkdown } from 'mdast-util-from-markdown'

export const DEFAULT_ARTICLE_COVER = '/images/hero-bg.jpg'

export function safeArticleImage(value) {
  if (typeof value !== 'string') return ''
  const url = value.trim()
  if (!url || /^[#?]/.test(url) || /[\u0000-\u001f\u007f\\]/.test(url)) return ''
  if (/^data:image\/(?:png|jpeg|gif|webp|avif);base64,[a-z0-9+/=]+$/i.test(url)) return url
  try {
    const parsed = new URL(url, 'https://rd-studio.club/article/')
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password) return ''
    return /^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('//') ? parsed.href : parsed.pathname + parsed.search + parsed.hash
  } catch { return '' }
}

export function firstArticleImage(content) {
  let tree
  try { tree = fromMarkdown(String(content || '')) } catch { return '' }
  const definitions = new Map()
  function walk(node, visit) {
    const stack = [node]
    while (stack.length) {
      const current = stack.pop(), result = visit(current)
      if (result) return result
      for (let index = (current.children || []).length - 1; index >= 0; index--) stack.push(current.children[index])
    }
    return ''
  }
  walk(tree, node => { if (node.type === 'definition' && !definitions.has(node.identifier)) definitions.set(node.identifier, node.url); return '' })
  return walk(tree, node => node.type === 'image' ? safeArticleImage(node.url) : node.type === 'imageReference' ? safeArticleImage(definitions.get(node.identifier)) : '')
}

export function articleCover(article) {
  const image = Object.hasOwn(article, 'first_image_url') ? safeArticleImage(article.first_image_url) : firstArticleImage(article.content)
  return image || DEFAULT_ARTICLE_COVER
}
