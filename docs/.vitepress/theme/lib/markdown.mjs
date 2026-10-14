import MarkdownIt from 'markdown-it'
import { tex } from '@mdit/plugin-tex'
import { alert } from '@mdit/plugin-alert'
import katex from 'katex'
import footnote from 'markdown-it-footnote'
import mark from 'markdown-it-mark'
import sub from 'markdown-it-sub'
import sup from 'markdown-it-sup'
import deflist from 'markdown-it-deflist'
import { full as emoji } from 'markdown-it-emoji'
import anchor from 'markdown-it-anchor'
import toc from 'markdown-it-table-of-contents'
import taskLists from 'markdown-it-task-lists'
import hljs from 'highlight.js/lib/common'

const escape = MarkdownIt().utils.escapeHtml
const labelPattern = /\\label\{([^{}\s]{1,100})\}/g
const referencePattern = /\\(eqref|ref)\{([^{}\s]{1,100})\}/g
const equationId = label => 'rd-equation-' + encodeURIComponent(label)
const slugify = text => 'rd-heading-' + encodeURIComponent(String(text).trim().toLowerCase().replace(/\s+/g, '-'))

function localSyntax(md) {
  // Token rules preserve syntax examples inside code spans and fences.
  md.inline.ruler.before('emphasis', 'rd_comment', state => {
    if (!state.src.startsWith('%%', state.pos)) return false
    const end = state.src.indexOf('%%', state.pos + 2)
    if (end < 0) return false
    state.pos = end + 2
    return true
  })
  md.block.ruler.before('paragraph', 'rd_comment_block', (state, start, end, silent) => {
    const pos = state.bMarks[start] + state.tShift[start]
    if (state.sCount[start] - state.blkIndent >= 4 || !state.src.startsWith('%%', pos)) return false
    const close = state.src.indexOf('%%', pos + 2)
    if (close < 0) return false
    let last = start
    while (last < end && state.eMarks[last] < close + 2) last++
    if (last >= end || state.src.slice(close + 2, state.eMarks[last]).trim()) return false
    if (!silent) state.line = last + 1
    return true
  })
  md.inline.ruler.before('link', 'rd_wiki', (state, silent) => {
    if (!state.src.startsWith('[[', state.pos)) return false
    const match = /^\[\[([^\]\n|]+)(?:\|([^\]\n]+))?\]\]/.exec(state.src.slice(state.pos))
    if (!match || /^toc$/i.test(match[1])) return false
    if (!silent) {
      const token = state.push('rd_wiki', '', 0)
      token.meta = { target: match[1].trim(), title: (match[2] || match[1]).trim() }
    }
    state.pos += match[0].length
    return true
  })
  md.renderer.rules.rd_wiki = (tokens, index) => {
    const { target, title } = tokens[index].meta
    return target.startsWith('#')
      ? `<a class="wiki-tag" href="/articles?tag=${encodeURIComponent(target.slice(1))}">${escape(title)}</a>`
      : `<a class="wiki-link" data-wiki-title="${escape(target)}" href="/article?title=${encodeURIComponent(target)}">${escape(title)}</a>`
  }
  md.inline.ruler.before('escape', 'rd_equation_ref', (state, silent) => {
    const match = /^\\(eqref|ref)\{([^{}\s]{1,100})\}/.exec(state.src.slice(state.pos))
    if (!match) return false
    if (!silent) {
      const token = state.push('rd_equation_ref', '', 0)
      token.meta = { label: match[2], parentheses: match[1] === 'eqref' }
    }
    state.pos += match[0].length
    return true
  })
  md.renderer.rules.rd_equation_ref = (tokens, index, options, env) => {
    const { label, parentheses } = tokens[index].meta
    const number = env.equations.get(label)
    if (!number) return `<span class="rd-reference-missing" title="未找到公式标签">${escape('\\' + (parentheses ? 'eqref' : 'ref') + '{' + label + '}')}</span>`
    return `<a href="#${equationId(label)}" class="rd-equation-ref">${escape(parentheses ? '(' + number + ')' : number)}</a>`
  }
  md.inline.ruler.before('html_inline', 'rd_safe_style', (state, silent) => {
    const input = state.src.slice(state.pos)
    const simple = /^<\/?(?:span|sub|sup|mark|kbd)>/i.exec(input)
    const styled = /^<span\s+style=(['"])([^'"<>]*)\1\s*>/i.exec(input)
    if (!simple && !styled) return false
    let html = simple?.[0].toLowerCase()
    if (styled) {
      const styles = styled[2].split(';').map(part => part.trim()).filter(Boolean)
      if (!styles.length || !styles.every(part => /^(?:color|background-color):\s*(?:#[\da-f]{3,8}|[a-z]{1,20}|rgba?\([\d\s.,%]+\))$/i.test(part) || /^font-size:\s*(?:[89]|[1-3]\d|4[0-8])px$/i.test(part))) return false
      html = `<span style="${escape(styles.join(';'))}">`
    }
    if (!silent) { const token = state.push('html_inline', '', 0); token.content = html }
    state.pos += (simple || styled)[0].length
    return true
  })
}

function prepareEquations(tokens, env) {
  env.equations = new Map()
  let count = 0
  for (const token of tokens) {
    if (token.type !== 'math_block') continue
    const labels = [...token.content.matchAll(labelPattern)].map(match => match[1])
    const explicitTag = /\\tag\*?\{([\w.:-]{1,40})\}/.exec(token.content)?.[1]
    if (!labels.length) continue
    const number = explicitTag || String(++count)
    for (const label of labels) if (!env.equations.has(label)) env.equations.set(label, number)
    token.meta = { labels, number, explicitTag }
  }
}

function renderMath(source, displayMode, env, meta) {
  let latex = source.replace(labelPattern, '')
  latex = latex.replace(referencePattern, (match, type, label) => {
    const number = env.equations.get(label)
    return number ? `\\text{${type === 'eqref' ? '(' + number + ')' : number}}` : '\\text{??}'
  })
  // One Markdown display block gets one number, including an aligned group of rows.
  latex = latex.replace(/^\s*\\begin\{equation\*?\}([\s\S]*)\\end\{equation\*?\}\s*$/, '$1')
  if (meta?.number && !meta.explicitTag) latex += `\\tag{${meta.number}}`
  const content = katex.renderToString(latex, { displayMode, throwOnError: false, trust: false, strict: 'ignore', maxExpand: 1000, maxSize: 20, macros: {} })
  const tag = displayMode ? 'div' : 'span'
  const ids = (meta?.labels || []).map(label => `<span id="${equationId(label)}" class="rd-equation-anchor"></span>`).join('')
  return `${ids}<${tag} class="rd-math${displayMode ? ' rd-math-display' : ''}" data-tex="${escape(source.trim())}" data-display="${displayMode}">${content}</${tag}>`
}

function createRenderer({ catalog = false } = {}) {
  const md = new MarkdownIt({ html: false, linkify: true, breaks: false, highlight(code, language) {
    return language && hljs.getLanguage(language) ? hljs.highlight(code, { language, ignoreIllegals: true }).value : ''
  } })
  md.use(footnote).use(mark).use(sub).use(sup).use(deflist).use(emoji, { shortcuts: {} }).use(taskLists)
  md.use(alert, { deep: true })
  md.use(tex, { delimiters: 'all', render: (content, display, env) => renderMath(content, display, env) })
  md.use(anchor, { slugify, tabIndex: false })
  md.use(toc, { markerPattern: /^\[\[?toc\]?\]\s*$/im, includeLevel: [1, 2, 3, 4, 5, 6], slugify, format: text => escape(text) })
  md.use(localSyntax)
  md.core.ruler.push('rd_equations', state => prepareEquations(state.tokens, state.env))
  md.renderer.rules.math_block = (tokens, index, options, env) => renderMath(tokens[index].content, true, env, tokens[index].meta)
  const validate = md.validateLink.bind(md)
  md.validateLink = url => validate(url) && (catalog ? /^https:\/\//i.test(url) || /^\/api\/files\/catalog\//.test(url) || /^#/.test(url) : !/^data:/i.test(url))
  const image = md.renderer.rules.image
  md.renderer.rules.image = (tokens, index, options, env, renderer) => {
    tokens[index].attrSet('loading', 'lazy')
    tokens[index].attrSet('referrerpolicy', 'no-referrer')
    return image(tokens, index, options, env, renderer)
  }
  md.renderer.rules.link_open = (tokens, index, options, env, renderer) => {
    if (/^https?:\/\//i.test(tokens[index].attrGet('href') || '')) {
      tokens[index].attrSet('target', '_blank')
      tokens[index].attrSet('rel', 'noopener noreferrer')
    }
    return renderer.renderToken(tokens, index, options)
  }
  return content => md.render(String(content || ''), { equations: new Map() })
}

export const renderArticleMarkdown = createRenderer()
export const renderCatalogMarkdown = createRenderer({ catalog: true })
