import { fromMarkdown } from 'mdast-util-from-markdown'
import { readFile, realpath, stat } from 'node:fs/promises'
import { resolve, dirname, relative, isAbsolute, sep } from 'node:path'
import { createHash } from 'node:crypto'

const digest=value=>createHash('sha256').update(value).digest('hex')
function inside(root,file) {
  const rel=relative(root,file)
  return rel==='' || (!isAbsolute(rel) && rel!=='..' && !rel.startsWith('..'+sep))
}
async function boundedFile(path,root,limit) {
  const actual=await realpath(path)
  if(!inside(root,actual))throw new Error('文件超出 RD_STUDIO_NOTES_ROOT：'+path)
  const info=await stat(actual)
  if(!info.isFile() || info.size>limit)throw new Error('文件不存在、不是普通文件或超过上传上限：'+path)
  const bytes=await readFile(actual)
  if(bytes.length>limit)throw new Error('文件超过上传上限')
  return {actual,bytes}
}
function nodes(root) {
  const result=[]
  function walk(node) {result.push(node);node.children?.forEach(walk)}
  walk(root)
  return result
}
export async function uploadVideoNote({note_path,title,summary='',tags=[],id,expected_revision,import_key,knowledge_branch_id}, {root,request}) {
  if(!root)throw new Error('请先配置 RD_STUDIO_NOTES_ROOT，指定允许读取的笔记目录')
  if(id&&!expected_revision)throw new Error('更新前请读取 get_own_draft，并提供 expected_revision')
  const allowed=await realpath(resolve(root))
  const note=await boundedFile(resolve(allowed,note_path),allowed,2*1024*1024)
  if(!/\.md$/i.test(note.actual))throw new Error('请选择 .md 笔记文件')
  const markdown=note.bytes.toString('utf8')
  const ast=nodes(fromMarkdown(markdown))
  const definitions=new Map(ast.filter(n=>n.type==='definition').map(n=>[n.identifier.toUpperCase(),n]))
  const images=[]
  for(const node of ast) {
    if(!['image','imageReference'].includes(node.type))continue
    const definition=node.type==='imageReference'?definitions.get(node.identifier.toUpperCase()):node
    if(!definition)throw new Error('图片引用缺少定义：'+node.identifier)
    const url=definition.url
    if(/^https?:\/\//i.test(url)||url.startsWith('/api/files/'))continue
    if(/^[a-z][a-z0-9+.-]*:/i.test(url)||url.startsWith('/')||url.startsWith('\\'))throw new Error('图片必须是笔记目录内的相对路径：'+url)
    const decoded=decodeURIComponent(url).replace(/\\/g,'/')
    images.push({node,definition,path:resolve(dirname(note.actual),decoded)})
  }
  if(images.length>100)throw new Error('一次笔记最多上传 100 个图片引用')
  // Validate every local file before starting network writes; code fences are not image nodes.
  const files=new Map()
  for(const image of images) {
    if(!files.has(image.path))files.set(image.path,await boundedFile(image.path,allowed,5*1024*1024))
  }
  const identity=await request('get_upload_identity',{})
  const uploads=new Map(),replacements=[]
  for(const image of images) {
    const file=files.get(image.path)
    const checksum=digest(file.bytes)
    if(!uploads.has(checksum))uploads.set(checksum,await request('upload_note_image',{base64:file.bytes.toString('base64')}))
    const uploaded=uploads.get(checksum)
    const alt=String(image.node.alt||'').replace(/([\\\[\]])/g,'\\$1')
    const caption=image.definition.title ? ' "'+image.definition.title.replace(/([\\"])/g,'\\$1')+'"' : ''
    replacements.push({start:image.node.position.start.offset,end:image.node.position.end.offset,text:'!['+alt+'](<'+uploaded.url+'>'+caption+')'})
  }
  let content=markdown
  for(const item of replacements.sort((a,b)=>b.start-a.start))content=content.slice(0,item.start)+item.text+content.slice(item.end)
  const heading=ast.find(node=>node.type==='heading'&&node.depth===1)
  const headingText=heading?.children.map(child=>child.value||'').join('')
  const result=await request('save_article_draft',{
    ...(id?{id,expected_revision}:{import_key:import_key||'v2md-'+digest(note.actual)}),
    title:title||headingText||'视频笔记',summary,markdown:content,
    ...(knowledge_branch_id!==undefined?{knowledge_branch_id}:{}),
    tags:[...new Set([...tags.filter(tag=>tag!=='手搓'),'视频转文'])]
  })
  return {...result,uploaded_images:uploads.size,rewritten_image_references:replacements.length,upload_user:identity.username}
}

export function createUploadRequest(siteUrl,token) {
  return async(tool,input)=>{
    if(!token)throw new Error('请先配置 RD_STUDIO_UPLOAD_TOKEN')
    const response=await fetch(new URL('/api/note-upload/'+tool,siteUrl),{
      method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(input),redirect:'error',signal:AbortSignal.timeout(60000)
    })
    const data=await response.json().catch(()=>({message:'上传服务响应无效'}))
    if(!response.ok)throw new Error('HTTP '+response.status+': '+(data.message||'上传失败'))
    return data
  }
}
