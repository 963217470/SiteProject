import { afterEach, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { renderArticleMarkdown, renderCatalogMarkdown } from '../docs/.vitepress/theme/lib/markdown.mjs'
import { copyMarkdownSelection } from '../docs/.vitepress/theme/lib/markdown-copy.mjs'

const source = readFileSync('docs/public/examples/markdown-compatibility.md', 'utf8')
const documentFor = html => { const root = document.createElement('div'); root.innerHTML = html; return root }
afterEach(() => { document.getSelection().removeAllRanges(); document.body.innerHTML = '' })

for (const [name, render] of [['article', renderArticleMarkdown], ['catalog', renderCatalogMarkdown]]) {
  it(name + ' preserves variable length fences, nested lists, tables and following headings', () => {
    const root = documentFor(render(source))
    const code = root.querySelector('pre code').textContent
    expect(code).toContain('```js')
    expect(code).toContain('$x^2$')
    expect(code).toContain('%%代码不应被隐藏%%')
    expect([...root.querySelectorAll('h2')].some(el => el.textContent === '3. 代码之后的标题')).toBe(true)
    expect(root.querySelector('ul ul')).not.toBeNull()
    expect(root.querySelector('table td strong')?.textContent).toBe('粗体')
    expect(root.querySelector('code.language-mermaid')?.textContent).toContain('graph LR')
  })
  it(name + ' renders delimiters, forward equation references, manual numbering and isolated document state', () => {
    const root = documentFor(render(source))
    expect(root.querySelectorAll('.rd-math').length).toBe(6)
    expect(root.querySelector('.katex-error')).toBeNull()
    expect([...root.querySelectorAll('.rd-equation-ref')].map(el => el.textContent)).toEqual(['(1)', '(1)', '(2)', '(3.1)'])
    root.querySelectorAll('.rd-equation-ref').forEach(link => expect(root.querySelector('[id="' + link.getAttribute('href').slice(1) + '"]')).not.toBeNull())
    expect(render('引用 \\eqref{eq:energy}')).toContain('rd-reference-missing')
  })
  it(name + ' enables safe optional syntax without transforming code examples', () => {
    const root = documentFor(render(source))
    expect(root.querySelector('mark')?.textContent).toBe('高亮文字')
    expect(root.querySelector('sub')?.textContent).toBe('2')
    expect(root.querySelector('.markdown-alert-note strong')?.textContent).toBe('粗体')
    expect(root.querySelectorAll('.footnote-item').length).toBe(2)
    expect(root.querySelectorAll('.footnote-item')[1].querySelectorAll('p').length).toBe(2)
    expect(root.querySelector('dt')?.textContent).toBe('术语')
    expect(root.querySelector('span[style]')?.style.color).toBe('rgb(184, 48, 46)')
    expect(root.textContent).not.toContain('这段注释不应显示')
    expect(root.textContent).not.toContain('隐藏的注释标题')
    expect(root.textContent).not.toContain(':smile:')
    expect(root.textContent).toContain('@demo2026')
    const toc = root.querySelector('.table-of-contents')
    expect(toc.textContent).not.toContain('代码中的标题')
    toc.querySelectorAll('a').forEach(link => expect(root.querySelector('[id="' + link.getAttribute('href').slice(1) + '"]')).not.toBeNull())
  })
  it(name + ' rejects executable HTML, unsafe style and links while keeping code literal', () => {
    const root = documentFor(render('<script>alert(1)</script>\n\n<img src=x onerror=alert(1)>\n\n[x](javascript:alert(1))\n\n<span style="position:fixed;inset:0">overlay</span>\n\n`[[<img src=x>|link]]`'))
    expect(root.querySelector('script,img,[onerror],[style],a')).toBeNull()
    expect(root.querySelector('code').textContent).toContain('[[<img')
  })
}

it('copies a selection containing math as one LaTeX representation, including partial math selections', () => {
  const root = documentFor(renderArticleMarkdown('before $E=mc^2$ after'))
  document.body.append(root)
  const clipboard = new Map()
  const copy = () => { let prevented = false; copyMarkdownSelection({ currentTarget: root, clipboardData: { setData: (type, text) => clipboard.set(type, text) }, preventDefault: () => { prevented = true } }); return prevented }
  const range = document.createRange()
  range.selectNodeContents(root)
  document.getSelection().addRange(range)
  expect(copy()).toBe(true)
  expect(clipboard.get('text/plain')).toBe('before $E=mc^2$ after')
  expect(clipboard.get('text/html')).not.toContain('katex')
  document.getSelection().removeAllRanges()
  range.selectNodeContents(root.querySelector('.katex-html'))
  document.getSelection().addRange(range)
  expect(copy()).toBe(true)
  expect(clipboard.get('text/plain')).toBe('$E=mc^2$')
})

it('leaves native copy of ordinary rich text alone', () => {
  const root = documentFor('<p><strong>bold</strong></p>')
  document.body.append(root)
  const range = document.createRange(); range.selectNodeContents(root); document.getSelection().addRange(range)
  copyMarkdownSelection({ currentTarget: root, clipboardData: { setData: () => { throw Error('unexpected override') } }, preventDefault: () => { throw Error('unexpected prevention') } })
})
