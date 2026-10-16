export const mindmapLimits = { nodes: 300, depth: 16, text: 500, body: 50000, markdown: 200000 }

// Keep the interchange format plain: no HTML, remote images, or library options.
export function normalizeMindmap(input) {
  let count = 0, size = 0
  const seen = new Set()
  function visit(node, depth) {
    if (!node || typeof node !== 'object' || Array.isArray(node) || seen.has(node)) throw new Error('节点格式无效或存在循环引用')
    if (++count > mindmapLimits.nodes || depth > mindmapLimits.depth) throw new Error('导图最多 300 个节点、16 层')
    seen.add(node)
    if (Object.keys(node).some(key => !['text', 'body', 'children'].includes(key))) throw new Error('节点仅接受 text、body、children')
    if (typeof node.text !== 'string' || !node.text.trim() || node.text.length > mindmapLimits.text || /[\r\n]/.test(node.text)) throw new Error('节点标题需为 1–500 字的单行文本')
    if (node.body !== undefined && (typeof node.body !== 'string' || node.body.length > mindmapLimits.body)) throw new Error('节点笔记过长或格式无效')
    if (node.children !== undefined && !Array.isArray(node.children)) throw new Error('children 必须为数组')
    const body = node.body || ''
    size += node.text.length + body.length
    if (size > mindmapLimits.markdown) throw new Error('导图内容不能超过 20 万字')
    return { text: node.text.trim(), body, children: (node.children || []).map(child => visit(child, depth + 1)) }
  }
  return visit(input, 1)
}

const escapeText = text => text.replace(/[\\`*_{}\[\]<>()#+\-.!|~^=:]/g, '\\$&')

export function mindmapToMarkdown(input) {
  const root = normalizeMindmap(input)
  const lines = ['<!-- rd-mindmap:v1 -->', '']
  function visit(node, depth) {
    const indent = depth >= 6 ? '  '.repeat(depth - 6) : ''
    lines.push(depth < 6 ? '#'.repeat(depth + 1) + ' ' + escapeText(node.text) : indent + '- ' + escapeText(node.text))
    lines.push('')
    if (node.body) {
      // Body blocks inside deep lists must retain CommonMark list indentation.
      const prefix = depth >= 6 ? indent + '  ' : ''
      // A marked blockquote keeps headings/lists in a note from becoming nodes.
      lines.push(...node.body.split('\n').map(line => prefix + '> ' + line), '')
    }
    node.children.forEach(child => visit(child, depth + 1))
  }
  visit(root, 0)
  const value = lines.join('\n')
  if (value.length > mindmapLimits.markdown) throw new Error('导出的 Markdown 超过 20 万字')
  return value
}

export function mindmapDraft(notes, user, input, siteUrl) {
  const tree = normalizeMindmap(input.tree)
  const tags = [...new Set(['思维导图', ...(input.tags || [])])].slice(0, 50)
  const saved = notes.saveDraft(user, { ...input, title: input.title || tree.text.slice(0, 300), markdown: mindmapToMarkdown(tree), tags })
  return { ...saved, mindmap_url: new URL('/mindmap/?id=' + encodeURIComponent(saved.id), siteUrl).href, node_count: countMindmap(tree) }
}

export function countMindmap(tree) {
  return 1 + (tree.children || []).reduce((sum, child) => sum + countMindmap(child), 0)
}
