import MarkdownIt from 'markdown-it'
import katexPlugin from '@vscode/markdown-it-katex'

const md = new MarkdownIt({ html: false, linkify: true, breaks: false })
md.use(katexPlugin.default || katexPlugin, { throwOnError: false, trust: false })
const validate = md.validateLink.bind(md)
md.validateLink = url => validate(url) && (/^https:\/\//i.test(url) || /^\/api\/files\/catalog\//.test(url))
const image = md.renderer.rules.image
md.renderer.rules.image = (tokens, index, options, env, renderer) => {
  tokens[index].attrSet('loading','lazy')
  tokens[index].attrSet('referrerpolicy','no-referrer')
  return image(tokens,index,options,env,renderer)
}
md.renderer.rules.link_open = (tokens,index,options,env,renderer) => {
  tokens[index].attrSet('target','_blank')
  tokens[index].attrSet('rel','noopener noreferrer')
  return renderer.renderToken(tokens,index,options)
}
export const renderCatalogMarkdown = content => md.render(content || '')
