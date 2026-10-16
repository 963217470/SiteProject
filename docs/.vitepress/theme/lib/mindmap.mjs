import { fromMarkdown } from 'mdast-util-from-markdown'
export { normalizeMindmap, mindmapToMarkdown, countMindmap, mindmapLimits } from '../../../../mcp/rd-studio-mcp/mindmap.mjs'
import { normalizeMindmap, mindmapLimits } from '../../../../mcp/rd-studio-mcp/mindmap.mjs'

const text = node => node.type === 'image' ? node.alt || '图片' : node.value ?? (node.children || []).map(text).join('')

export function markdownToMindmap(markdown, title = '未命名导图') {
  if (typeof markdown !== 'string' || !markdown.trim()) throw new Error('请输入 Markdown 内容')
  if (markdown.length > mindmapLimits.markdown) throw new Error('Markdown 不能超过 20 万字')
  const source = markdown.replace(/\r\n?/g, '\n')
  const ast = fromMarkdown(source)
  const ownFormat = ast.children[0]?.type === 'html' && ast.children[0].value === '<!-- rd-mindmap:v1 -->'
  const blocks = ownFormat ? ast.children.slice(1) : ast.children
  const root = { text: title.trim() || '未命名导图', body: '', children: [] }
  const stack = [{ depth: 0, node: root }]
  const slice = node => source.slice(node.position.start.offset, node.position.end.offset)
  const inlineNote = node => {
    const children = node.children || []
    const raw = children.length ? source.slice(children[0].position.start.offset, children.at(-1).position.end.offset) : ''
    return children.some(child => child.type !== 'text') || raw.includes('\n') ? raw : ''
  }
  const appendBody = (target, node, indent = 0) => {
    let raw = slice(node).split('\n').map((line, index) => index ? line.slice(Math.min(indent, line.match(/^ */)[0].length)) : line).join('\n')
    if (ownFormat && node.type === 'blockquote') raw = raw.split('\n').map(line => line.replace(/^> ?/, '')).join('\n')
    target.body += (target.body ? '\n\n' : '') + raw
  }
  function listItems(list, parent) {
    for (const item of list.children) {
      const first = item.children[0]
      const node = { text: (first?.type === 'paragraph' ? text(first) : '条目').replace(/\s*\n\s*/g, ' ').trim() || '条目', body: first?.type === 'paragraph' ? inlineNote(first) : '', children: [] }
      parent.children.push(node)
      item.children.forEach((block, i) => {
        if (i === 0 && block.type === 'paragraph') return
        if (block.type === 'list') listItems(block, node)
        else appendBody(node, block, block.position.start.column - 1)
      })
    }
  }
  for (const block of blocks) {
    if (block.type === 'heading') {
      while (stack.length > 1 && stack.at(-1).depth >= block.depth) stack.pop()
      const node = { text: text(block).replace(/\n/g, ' ').trim() || '未命名节点', body: inlineNote(block), children: [] }
      stack.at(-1).node.children.push(node)
      stack.push({ depth: block.depth, node })
    } else if (block.type === 'list') listItems(block, stack.at(-1).node)
    else appendBody(stack.at(-1).node, block)
  }
  const actual = !root.body && root.children.length === 1 && blocks[0]?.type === 'heading' ? root.children[0] : root
  return normalizeMindmap(actual)
}

export function toCanvasTree(tree) {
  return { data: { text: tree.text, rdBody: tree.body || '', expand: true }, children: tree.children.map(toCanvasTree) }
}

export function fromCanvasTree(tree) {
  return normalizeMindmap({ text: tree.data.text, body: tree.data.rdBody || '', children: (tree.children || []).map(fromCanvasTree) })
}

export const starterMindmap = () => ({ text: '我的游戏创意', body: '', children: [
  { text: '核心玩法', body: '', children: [{ text: '玩家目标', body: '', children: [] }, { text: '操作与反馈', body: '', children: [] }] },
  { text: '美术与世界', body: '', children: [] }, { text: '开发计划', body: '', children: [] }
] })
