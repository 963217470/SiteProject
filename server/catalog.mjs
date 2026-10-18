import { randomUUID, createHmac } from 'node:crypto'
import {adminAudit} from './admin-audit.mjs'
import { fail } from './repository.mjs'

export const catalogFileUrl = file => '/api/files/catalog/' + file.path.split('/').map(encodeURIComponent).join('/')
export function catalogFileVisible(db, file, user) {
  if (user?.id === file.owner_id || user?.role === 'admin') return true
  return Boolean(db.prepare("SELECT 1 FROM catalog_items i,json_each(i.assets) a WHERE a.value=? AND (i.status='published' OR i.author_id=?) LIMIT 1").get(file.id,user?.id||''))
}
export function installCatalogRoutes(app, db, repository, config) {
  const now = config.now || Date.now
  const logged = req => { if (!req.user) fail(401, '请先登录'); return req.user }
  const admin = req => { if (logged(req).role !== 'admin') fail(403, '需要管理员权限') }
  function item(id, user) {
    const row = db.prepare('SELECT i.*,p.username FROM catalog_items i JOIN profiles p ON p.id=i.author_id WHERE i.id=?').get(id)
    if (!row || !(row.status === 'published' || user?.id === row.author_id || user?.role === 'admin')) fail(404, '作品不存在或暂未公开')
    return row
  }
  function project(row, detail = false) {
    const assets = JSON.parse(row.assets).map(id => db.prepare('SELECT id,path,mime,size FROM files WHERE id=?').get(id)).filter(Boolean).map(f => ({ ...f, name: f.path.split('/').at(-1), url: catalogFileUrl(f) }))
    return { ...row, download_links: JSON.parse(row.download_links), content: detail ? row.content : undefined, assets: detail ? assets : undefined, cover_url: assets.find(f => f.id === row.cover_id)?.url || '' }
  }
  function text(value, limit, required = false) {
    if (typeof value !== 'string' || value.length > limit || (required && !value.trim())) fail(400, '内容为空或超过长度限制')
    return value.trim()
  }
  function payload(body, user, existing=null) {
    if (!body || !['game','tool'].includes(body.kind)) fail(400, '请选择游戏或工具')
    const previous=existing ? JSON.parse(existing.download_links) : []
    let links=body.download_links
    // Old clients may still edit the first URL; never discard their other mirrors.
    if(links===undefined){
      if(existing && body.external_url===undefined)links=previous
      else {
        const url=text(body.external_url || '',2000)
        links=url ? [{id:previous[0]?.id,label:previous[0]?.label || '外部下载',url,extraction_code:body.extraction_code || ''},...previous.slice(1)] : previous.slice(1)
      }
    }
    if(!Array.isArray(links) || links.length>10)fail(400,'最多添加 10 条下载路径')
    const ids=new Set(),urls=new Set()
    links=links.map(link=>{
      if(!link || typeof link!=='object' || Array.isArray(link) || Object.keys(link).some(key=>!['id','label','url','extraction_code'].includes(key)))fail(400,'下载路径格式无效')
      const value=text(link.url,2000,true)
      let url;try{url=new URL(value)}catch{fail(400,'下载链接无效')}
      if(url.protocol!=='https:' || url.username || url.password)fail(400,'下载链接需要使用 HTTPS，且不能包含账号密码')
      if(urls.has(url.href))fail(400,'下载链接重复');urls.add(url.href)
      const id=link.id===undefined ? randomUUID() : text(link.id,64,true)
      if(link.id!==undefined && !previous.some(old=>old.id===id))fail(400,'下载路径标识无效')
      if(!/^[a-zA-Z0-9-]+$/.test(id) || ids.has(id))fail(400,'下载路径标识重复或无效');ids.add(id)
      return {id,label:text(link.label || url.hostname,60,true),url:value,extraction_code:text(link.extraction_code || '',100)}
    })
    const external_url=links[0]?.url || '',extraction_code=links[0]?.extraction_code || ''
    if (!Array.isArray(body.assets) || body.assets.length > 20 || new Set(body.assets).size !== body.assets.length) fail(400, '最多关联 20 个文件')
    const assets = body.assets.map(id => {
      const file = typeof id === 'string' && db.prepare("SELECT * FROM files WHERE id=? AND bucket='catalog'").get(id)
      if (!file || !(file.owner_id===user.id || existing && JSON.parse(existing.assets).includes(id))) fail(403, '只能关联自己的专区文件或该作品原有附件')
      return file
    })
    if (body.cover_id && !assets.some(f => f.id === body.cover_id && f.mime.startsWith('image/'))) fail(400, '封面必须是已上传的图片')
    const content = text(body.content, 200000, true)
    // Local image references must be owned attachments; publishing cannot expose another user's file.
    for (const match of content.matchAll(/\/api\/files\/catalog\/[^\s)<>"']+/g)) {
      if (!assets.some(f => catalogFileUrl(f) === match[0])) fail(400, '正文引用了未关联的专区文件')
    }
    if (!['draft','pending','published'].includes(body.status)) fail(400, '无效的发布状态')
    const status = body.status === 'published' && user.role !== 'admin' ? 'pending' : body.status
    if (status !== 'draft' && !external_url && !assets.some(f => !f.mime.startsWith('image/'))) fail(400, '请添加下载链接或文件附件')
    return { kind: body.kind, title: text(body.title,120,true), summary: text(body.summary || '',300), content, version: text(body.version || '',60), platform: text(body.platform || '',120), license: text(body.license || '',120), external_url, extraction_code, download_links:JSON.stringify(links), cover_id: body.cover_id || null, assets: JSON.stringify(body.assets), status }
  }
  app.get('/api/catalog', (req,res) => {
    const scope = req.query.scope || 'public', kind = req.query.kind || '', query = req.query.q || '', offset = Number(req.query.offset || 0)
    if (!['public','mine','review'].includes(scope) || !['','game','tool'].includes(kind) || typeof query !== 'string' || query.length > 100 || !Number.isInteger(offset) || offset < 0) fail(400,'无效的筛选条件')
    const conditions=[], args=[]
    if (scope === 'mine') { conditions.push('i.author_id=?'); args.push(logged(req).id) }
    else if (scope === 'review') { admin(req); conditions.push("i.status='pending'") }
    else conditions.push("i.status='published'")
    if (kind) { conditions.push('i.kind=?'); args.push(kind) }
    if (query) { conditions.push("(i.title LIKE ? ESCAPE '\\' OR i.summary LIKE ? ESCAPE '\\')"); const escaped=query.replace(/[\\%_]/g,'\\$&');args.push('%'+escaped+'%','%'+escaped+'%') }
    const rows = db.prepare('SELECT i.*,p.username FROM catalog_items i JOIN profiles p ON p.id=i.author_id WHERE '+conditions.join(' AND ')+' ORDER BY i.updated_at DESC,i.id LIMIT 25 OFFSET ?').all(...args,offset)
    res.json({items:rows.slice(0,24).map(row=>project(row)),has_more:rows.length>24})
  })
  app.get('/api/catalog/publishers', (req,res) => {
    admin(req)
    const q=req.query.q||'',offset=Number(req.query.offset||0)
    if(typeof q!=='string'||q.length>100||!Number.isSafeInteger(offset)||offset<0)fail(400,'无效的用户筛选条件')
    const pattern='%'+q.replace(/[\\%_]/g,'\\$&')+'%'
    const rows=db.prepare("SELECT p.id,p.username,p.full_name FROM profiles p JOIN users u ON u.id=p.id WHERE p.username LIKE ? ESCAPE '\\' OR coalesce(p.full_name,'') LIKE ? ESCAPE '\\' ORDER BY p.username,p.id LIMIT 51 OFFSET ?").all(pattern,pattern,offset)
    res.json({items:rows.slice(0,50),has_more:rows.length>50})
  })
  app.get('/api/catalog/:id', (req,res) => res.json(project(item(req.params.id,req.user),true)))
  app.post('/api/catalog', (req,res) => {
    const user=logged(req), data=payload(req.body,user), id=randomUUID(), time=new Date(now()).toISOString(), fields=Object.keys(data)
    const author=req.body.author_id===undefined?user.id:req.body.author_id
    if(typeof author!=='string'||!author||author.length>100)fail(400,'请选择有效的发布用户')
    if(author!==user.id&&user.role!=='admin')fail(403,'只有管理员可以为其他用户发布作品')
    repository.transaction(() => {
      if(!db.prepare('SELECT p.id FROM profiles p JOIN users u ON u.id=p.id WHERE p.id=?').get(author))fail(404,'发布用户不存在，请重新选择')
      db.prepare(`INSERT INTO catalog_items(id,author_id,created_at,updated_at,${fields.join(',')}) VALUES(?,?,?,?,${fields.map(()=>'?').join(',')})`).run(id,author,time,time,...Object.values(data))
      if(author!==user.id)adminAudit(db,user,'代用户创建作品','catalog',id,JSON.stringify({author_id:author,status:data.status,kind:data.kind}),now())
    })
    res.status(201).json({id,status:data.status})
  })
  app.put('/api/catalog/:id', (req,res) => {
    const user=logged(req), row=item(req.params.id,user)
    if (row.author_id !== user.id) fail(403,'只能编辑自己的作品')
    if(req.body?.author_id!==undefined&&req.body.author_id!==row.author_id)fail(403,'不能更改已有作品的发布用户')
    if (!Number.isInteger(req.body?.revision) || req.body.revision<1) fail(400,'无效的作品版本')
    const data=payload(req.body,user,row), fields=Object.keys(data)
    const result=repository.transaction(() => db.prepare(`UPDATE catalog_items SET ${fields.map(f=>f+'=?').join(',')},review_note='',revision=revision+1,updated_at=? WHERE id=? AND revision=?`).run(...Object.values(data),new Date(now()).toISOString(),row.id,req.body.revision))
    if (!result.changes) fail(409,'作品已更新，请重新加载后编辑')
    res.json({id:row.id,status:data.status})
  })
  app.post('/api/catalog/:id/review', (req,res) => {
    admin(req)
    if (!Number.isInteger(req.body?.revision) || req.body.revision<1) fail(400,'无效的作品版本')
    const status=req.body?.status, note=text(req.body?.note || '',1000)
    if (!['published','rejected','archived'].includes(status) || (status !== 'published' && !note)) fail(400,'请填写审核或下架原因')
    const row=item(req.params.id,req.user)
    if (status !== 'archived' && row.status !== 'pending') fail(409,'作品已不在待审核状态')
    const result=repository.transaction(() => {const result=db.prepare('UPDATE catalog_items SET status=?,review_note=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').run(status,note,new Date(now()).toISOString(),row.id,req.body.revision);if(result.changes)adminAudit(db,req.user,'作品审核','catalog',row.id,status+(note?'：'+note:''),now());return result})
    if (!result.changes) fail(409,'作品已更新，请刷新后审核')
    res.json({ok:true})
  })
  app.post('/api/catalog/:id/download', (req,res) => {
    const row=item(req.params.id,req.user), target=req.body?.target
    if (row.status !== 'published') fail(409,'作品尚未公开，不能下载')
    let url,countTarget=target
    const links=JSON.parse(row.download_links),link=target==='external' ? links[0] : links.find(link=>'external:'+link.id===target)
    if (link) {url=link.url;countTarget=link.id==='legacy'?'external':'external:'+link.id}
    else { const file=JSON.parse(row.assets).includes(target) && db.prepare("SELECT * FROM files WHERE id=? AND bucket='catalog'").get(target); if (!file || file.mime.startsWith('image/')) fail(404,'下载文件不存在'); url=catalogFileUrl(file) }
    const visitor=createHmac('sha256',config.sessionSecret).update(req.user?.id || req.ip+'|'+(req.get('user-agent') || '').slice(0,300)).digest('hex')
    repository.transaction(()=>{
      const previous=db.prepare('SELECT last_at FROM catalog_downloads WHERE item_id=? AND visitor=? AND target=?').get(row.id,visitor,countTarget)
      if (!previous || now()-previous.last_at>=600000) {
        db.prepare('INSERT INTO catalog_downloads VALUES(?,?,?,?) ON CONFLICT(item_id,visitor,target) DO UPDATE SET last_at=excluded.last_at').run(row.id,visitor,countTarget,now())
        db.prepare('UPDATE catalog_items SET downloads=downloads+1 WHERE id=?').run(row.id)
      }
      db.prepare('DELETE FROM catalog_downloads WHERE last_at<?').run(now()-86400000)
    })
    res.json({url,downloads:db.prepare('SELECT downloads FROM catalog_items WHERE id=?').get(row.id).downloads})
  })
}
