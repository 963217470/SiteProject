import { describe, it, expect } from 'vitest'
import { markdownToMindmap, mindmapToMarkdown, normalizeMindmap, toCanvasTree, fromCanvasTree, starterMindmap } from '../docs/.vitepress/theme/lib/mindmap.mjs'

describe('mindmap interchange', () => {
  it('names only new maps 中心节点 and preserves existing imported roots', () => {
    expect(starterMindmap().text).toBe('中心节点')
    expect(markdownToMindmap('# My saved title').text).toBe('My saved title')
  })
  it('imports headings and nested lists without treating fenced headings as structure', () => {
    const source='# Game\n\nIntro $E=mc^2$\n\n## Gameplay\n\n- Jump\n  - Double jump\n- Run\n\n````md\n# not a node\n```js\nconst x=1\n```\n````\n\n![shot](/api/files/notes/image.png)'
    const tree=markdownToMindmap(source)
    expect(tree.text).toBe('Game')
    expect(tree.body).toBe('Intro $E=mc^2$')
    expect(tree.children[0].children.map(n=>n.text)).toEqual(['Jump','Run'])
    expect(tree.children[0].children[0].children[0].text).toBe('Double jump')
    expect(tree.children[0].body).toContain('````md\n# not a node')
    expect(tree.children[0].body).toContain('![shot](/api/files/notes/image.png)')
    expect(markdownToMindmap(mindmapToMarkdown(tree))).toEqual(tree)
  })
  it('round-trips punctuation, literal HTML, notes, unicode and deep branches', () => {
    const root={text:'RD <script> & # [x] ** / 游戏',body:'paragraph\n\n$$E=mc^2$$',children:[]}
    let cursor=root
    for(let i=0;i<12;i++){const next={text:'节点 '+i,body:'```js\nconst x = 1\n```',children:[]};cursor.children.push(next);cursor=next}
    expect(markdownToMindmap(mindmapToMarkdown(root))).toEqual(normalizeMindmap(root))
    expect(fromCanvasTree(toCanvasTree(root))).toEqual(root)
  })
  it('keeps multiple root headings and preamble rather than silently dropping them', () => {
    const tree=markdownToMindmap('Preamble\n\n# A\n\nbody\n\n# B','Document')
    expect(tree.text).toBe('Document');expect(tree.body).toBe('Preamble');expect(tree.children.map(n=>n.text)).toEqual(['A','B'])
    expect(markdownToMindmap('only prose')).toEqual({text:'未命名导图',body:'only prose',children:[]})
  })
  it('keeps heading/list syntax in node notes without promoting it to branches', () => {
    const tree=normalizeMindmap({text:'A',body:'# Note heading\n\n- a\n- b\n\n> quote\n\n[ref]: https://example.com',children:[{text:'B',body:'## Second heading'}]})
    expect(markdownToMindmap(mindmapToMarkdown(tree))).toEqual(tree)
  })
  it('retains images, links and inline styling used as node labels in notes', () => {
    const tree=markdownToMindmap('# [Game](https://example.com)\n\n- ![shot](/shot.png)\n- **important** and `code`')
    expect(tree.body).toBe('[Game](https://example.com)')
    expect(tree.children[0].body).toBe('![shot](/shot.png)')
    expect(tree.children[1].body).toBe('**important** and `code`')
    expect(markdownToMindmap(mindmapToMarkdown(tree))).toEqual(tree)
  })
  it('rejects cycles, executable library metadata, oversized and too-deep structures', () => {
    const cycle={text:'x',children:[]};cycle.children.push(cycle)
    expect(()=>normalizeMindmap(cycle)).toThrow()
    expect(()=>normalizeMindmap({text:'x',data:{richText:true}})).toThrow()
    expect(()=>normalizeMindmap({text:'x',children:Array.from({length:300},()=>({text:'child'}))})).toThrow()
    expect(()=>normalizeMindmap({text:'x\ny'})).toThrow()
    expect(()=>markdownToMindmap('a'.repeat(200001))).toThrow()
    expect(()=>normalizeMindmap({text:'x',children:'bad'})).toThrow()
  })
})
