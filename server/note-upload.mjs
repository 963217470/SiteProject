import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { writeFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { fileTypeFromBuffer } from 'file-type'
import { fail } from './repository.mjs'

const hash = value => createHash('sha256').update(value).digest('hex')
const imageTypes = new Set(['image/png','image/jpeg','image/webp','image/gif','image/avif'])
const maxImage = 5 * 1024 * 1024
const quota = 500 * 1024 * 1024
const revision = row => hash(JSON.stringify([row.title,row.summary,row.content,row.tags,row.status,row.visibility,row.kb_enabled,row.kb_branch_id]))

export function createNoteUpload(repository, config) {
  const db = repository.db
  const now = config.now || Date.now
  const siteUrl = new URL(config.siteUrl).origin
  const present = row => ({id:row.id,title:row.title,status:row.status,visibility:row.visibility,revision:revision(row),
    article_url:siteUrl+'/article?id='+encodeURIComponent(row.id),editor_url:siteUrl+'/editor?id='+encodeURIComponent(row.id)})
  function ownDraft(user,id) {
    const row = db.prepare("SELECT * FROM articles WHERE id=? AND author_id=? AND status='draft' AND visibility='public'").get(id,user.id)
    if (!row) fail(404,'本人公开草稿不存在；已提交或已发布的文章不能通过上传令牌修改')
    return row
  }
  return {
    authenticate(req) {
      const header=req.get('authorization')
      if (!header) return null
      if (!/^Bearer rd_[A-Za-z0-9_-]{43}$/.test(header)) fail(401,'上传令牌无效')
      const row=db.prepare('SELECT t.id token_id,t.allow_knowledge_write,p.* FROM mcp_tokens t JOIN profiles p ON p.id=t.user_id WHERE t.token_hash=? AND t.revoked_at IS NULL AND t.expires_at>?').get(hash(header.slice(7)),now())
      if (!row) fail(401,'上传令牌已失效或撤销')
      db.prepare('UPDATE mcp_tokens SET last_used_at=? WHERE id=?').run(now(),row.token_id)
      return row
    },
    identity(user) {return {id:user.id,username:user.username,permissions:['own-public-drafts','note-images',...(user.allow_knowledge_write?[user.role==='admin'?'knowledge-node-create':'knowledge-node-request']:[])],max_image_bytes:maxImage}},
    getDraft(user,id) {
      const row=ownDraft(user,id)
      return {...present(row),summary:row.summary,markdown:row.content,tags:JSON.parse(row.tags),knowledge_branch_id:row.kb_branch_id||null}
    },
    saveDraft(user,input) {
      return repository.transaction(()=>{
        const data={title:input.title.trim(),summary:input.summary||'',content:input.markdown,tags:input.tags||[],status:'draft',visibility:'public'}
        if(input.knowledge_branch_id!==undefined) {
          if(input.knowledge_branch_id && !db.prepare('SELECT id FROM knowledge_branches WHERE id=?').get(input.knowledge_branch_id))fail(404,'知识库分支不存在')
          data.kb_enabled=!!input.knowledge_branch_id;data.kb_branch_id=input.knowledge_branch_id||null
        }
        if (!data.title || !data.content.trim()) fail(400,'标题和正文不能为空')
        if (input.id) {
          const row=ownDraft(user,input.id)
          if (!input.expected_revision || input.expected_revision!==revision(row)) fail(409,'草稿已被修改，请重新读取草稿再确认更新')
          const encoded=repository.encode('articles',data)
          db.prepare("UPDATE articles SET title=?,summary=?,content=?,tags=?,updated_at=? WHERE id=? AND author_id=? AND status='draft'").run(encoded.title,encoded.summary,encoded.content,encoded.tags,new Date(now()).toISOString(),row.id,user.id)
          if(input.knowledge_branch_id!==undefined)db.prepare('UPDATE articles SET kb_enabled=?,kb_branch_id=? WHERE id=?').run(Number(data.kb_enabled),data.kb_branch_id,row.id)
          return present(ownDraft(user,row.id))
        }
        if (!input.import_key) fail(400,'新草稿需要 import_key，重复请求可避免重复建文')
        const existing=db.prepare('SELECT article_id FROM mcp_draft_imports WHERE user_id=? AND import_key=?').get(user.id,input.import_key)
        if (existing) {
          const row=ownDraft(user,existing.article_id)
          if (row.title!==data.title || row.summary!==data.summary || row.content!==data.content || row.tags!==JSON.stringify(data.tags) || (input.knowledge_branch_id!==undefined && row.kb_branch_id!==data.kb_branch_id)) fail(409,'该 import_key 已创建不同内容；请读取草稿后使用 id 和 revision 更新')
          return {...present(row),reused:true}
        }
        const row=repository.insert('articles',data,user)
        db.prepare('INSERT INTO mcp_draft_imports(user_id,import_key,article_id) VALUES(?,?,?)').run(user.id,input.import_key,row.id)
        return present(row)
      })
    },
    async uploadImage(user,{base64}) {
      if (!base64 || base64.length>Math.ceil(maxImage/3)*4 || base64.length%4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) fail(400,'需要 5MB 以内的标准 Base64 图片')
      const bytes=Buffer.from(base64,'base64')
      if (bytes.toString('base64')!==base64) fail(400,'Base64 编码无效')
      if (!bytes.length || bytes.length>Math.min(maxImage,config.maxUploadMb*1024*1024)) fail(413,'图片过大或为空')
      const type=await fileTypeFromBuffer(bytes).catch(()=>null)
      if (!type || !imageTypes.has(type.mime)) fail(400,'只支持 PNG、JPEG、WebP、GIF、AVIF 图片')
      const path=user.id+'/'+hash(bytes)+'.'+type.ext
      const url=siteUrl+'/api/files/notes/'+path
      const old=db.prepare("SELECT id,size FROM files WHERE bucket='notes' AND path=?").get(path)
      if (old) return {url,id:old.id,size:old.size,reused:true}
      const id=randomUUID()
      const file=join(config.dataDir,'uploads',id)
      await writeFile(file,bytes,{flag:'wx',mode:0o600})
      try {
        return repository.transaction(()=>{
          const duplicate=db.prepare("SELECT id,size FROM files WHERE bucket='notes' AND path=?").get(path)
          if (duplicate) return {url,id:duplicate.id,size:duplicate.size,reused:true}
          const used=db.prepare("SELECT coalesce(sum(size),0) size FROM files WHERE owner_id=? AND bucket='notes'").get(user.id).size
          if (used+bytes.length>quota) fail(413,'笔记图片存储已达 500MB 上限')
          db.prepare('INSERT INTO files(id,bucket,path,owner_id,mime,size) VALUES(?,?,?,?,?,?)').run(id,'notes',path,user.id,type.mime,bytes.length)
          return {url,id,size:bytes.length,mime:type.mime}
        })
      } catch(error) {await unlink(file).catch(()=>{});throw error}
      finally {
        if (!db.prepare('SELECT id FROM files WHERE id=?').get(id)) await unlink(file).catch(()=>{})
      }
    }
  }
}

export function installNoteTokenRoutes(app,repository,config) {
  const db=repository.db
  const now=config.now||Date.now
  const requireUser=(req,_res,next)=>{if(!req.user)return next(Object.assign(new Error('请先使用 GitHub 登录'),{status:401}));next()}
  app.get('/api/mcp-tokens',requireUser,(req,res)=>res.json(db.prepare('SELECT id,name,created_at,expires_at,last_used_at,revoked_at,allow_knowledge_write FROM mcp_tokens WHERE user_id=? ORDER BY created_at DESC').all(req.user.id)))
  app.post('/api/mcp-tokens',requireUser,(req,res)=>{
    const name=req.body?.name
    if (typeof name!=='string' || !name.trim() || name.length>60) fail(400,'请输入 1–60 字的令牌名称')
    const allowKnowledge=req.body.allow_knowledge_write??false
    if(typeof allowKnowledge!=='boolean')fail(400,'知识库写入权限必须为布尔值')
    const token='rd_'+randomBytes(32).toString('base64url')
    const row=repository.transaction(()=>{
      if (db.prepare('SELECT count(*) n FROM mcp_tokens WHERE user_id=? AND revoked_at IS NULL AND expires_at>?').get(req.user.id,now()).n>=10) fail(409,'最多保留 10 个有效上传令牌')
      const id=randomUUID(),created=now(),expires=created+90*86400000
      db.prepare('INSERT INTO mcp_tokens(id,user_id,name,token_hash,created_at,expires_at,allow_knowledge_write) VALUES(?,?,?,?,?,?,?)').run(id,req.user.id,name.trim(),hash(token),created,expires,Number(allowKnowledge))
      return {id,name:name.trim(),created_at:created,expires_at:expires,token,allow_knowledge_write:allowKnowledge}
    })
    res.status(201).json(row)
  })
  app.delete('/api/mcp-tokens/:id',requireUser,(req,res)=>{
    const result=db.prepare('UPDATE mcp_tokens SET revoked_at=? WHERE id=? AND user_id=? AND revoked_at IS NULL').run(now(),req.params.id,req.user.id)
    if(!result.changes)fail(404,'令牌不存在或已撤销')
    res.json({ok:true})
  })
}
