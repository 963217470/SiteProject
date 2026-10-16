import { expect, it } from 'vitest'
import { importTextDraft } from '../mcp/rd-studio-mcp/text-draft.mjs'
import { renderArticleMarkdown } from '../docs/.vitepress/theme/lib/markdown.mjs'

it('plain text survives the full website renderer without executing extended Markdown syntax',()=>{
  const text='# title\n<script>alert(1)</script>\n\n**literal**\n(x+y) \\(x+y\\) $x^2$\n%%keep me%%\n:smile:\n![image](https://example.com/x.png)\n[TOC]\n\n    indented text'
  let saved
  importTextDraft({saveDraft(_user,data){saved=data;return{id:'draft'}}},{id:'owner'},{import_key:'plain',text,format:'text'})
  const root=document.createElement('div');root.innerHTML=renderArticleMarkdown(saved.markdown)
  expect(root.querySelector('script,h1,strong,img,pre,a,.katex,.table-of-contents')).toBeNull()
  expect(root.textContent).toContain('%%keep me%%')
  expect(root.textContent).toContain(':smile:')
  expect(root.textContent).toContain('(x+y) \\(x+y\\) $x^2$')
  expect(root.textContent).toContain('<script>alert(1)</script>')
  expect(root.textContent).toContain('![image](https://example.com/x.png)')
})
