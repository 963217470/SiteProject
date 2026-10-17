import { createHash } from 'node:crypto'
import { fail } from './repository.mjs'

export function publicCreator(db,id) {
  if(!id)return null
  const profile=db.prepare('SELECT id,username,full_name FROM profiles WHERE id=?').get(id)
  return profile?{id:profile.id,username:profile.username,display_name:profile.full_name||profile.username}:null
}

export function createKnowledgeWriter(repository,config) {
  const db=repository.db,siteUrl=new URL(config.siteUrl).origin
  const branchResult=branch=>({status:'created',id:branch.id,node_id:'b:'+branch.id,name:branch.name,description:branch.description||'',parent_id:branch.parent_id,creator:publicCreator(db,branch.created_by),url:siteUrl+'/kb/?branch='+encodeURIComponent(branch.id)})
  const requestResult=request=>({status:request.status,request_id:request.id,requested_path:request.requested_path,description:request.requested_description||'',article_id:request.article_id,creator:publicCreator(db,request.requester_id),url:siteUrl+'/article?id='+encodeURIComponent(request.article_id),message:'创建申请已提交，审核通过后才会出现知识库节点。'})
  return (user,input)=>{
    if(!user.allow_knowledge_write)fail(403,'此令牌没有知识库节点写入权限，请在 MCP 页面创建勾选该权限的新令牌')
    const name=input.name.trim(),description=(input.description||'').trim(),parentId=input.parent_id||null
    if(!name || /[\\/\u0000-\u001f]/.test(name))fail(400,'节点名称不能为空，不能包含斜杠或控制字符；上级请用 parent_id 指定')
    if(input.connect_to!==undefined&&user.role!=='admin')fail(403,'自定义连线需要管理员权限，普通成员仍可提交目录分支申请')
    const payload=[name,description,parentId,input.article_id||null]
    if(input.connect_to!==undefined)payload.push(input.connect_to)
    const payloadHash=createHash('sha256').update(JSON.stringify(payload)).digest('hex')
    return repository.transaction(()=>{
      const previous=db.prepare('SELECT * FROM mcp_node_creations WHERE user_id=? AND request_key=?').get(user.id,input.request_key)
      if(previous) {
        if(previous.payload_hash!==payloadHash)fail(409,'request_key 已用于不同内容，请使用新的请求标识')
        return {...(previous.branch_id?branchResult(db.prepare('SELECT * FROM knowledge_branches WHERE id=?').get(previous.branch_id)):requestResult(db.prepare('SELECT * FROM knowledge_branch_requests WHERE id=?').get(previous.request_id))),reused:true}
      }
      if(parentId && !db.prepare('SELECT id FROM knowledge_branches WHERE id=?').get(parentId))fail(404,'上级分支不存在，请先调用 list_knowledge_branches 查询真实 ID')
      if(user.role==='admin') {
        const target=input.connect_to
        if(target!==undefined&&target!==null&&target!=='root') {
          if(typeof target!=='string'||!/^([ba]):[A-Za-z0-9_-]{1,100}$/.test(target))fail(400,'无效的连接对象')
          const valid=target.startsWith('b:')?db.prepare('SELECT id FROM knowledge_branches WHERE id=?').get(target.slice(2)):db.prepare("SELECT id FROM articles WHERE id=? AND kb_enabled=1 AND status='published'").get(target.slice(2))
          if(!valid)fail(404,'连接对象不存在')
        }
        const existing=db.prepare('SELECT * FROM knowledge_branches WHERE parent_id IS ? AND name=? ORDER BY created_at,id LIMIT 1').get(parentId,name)
        const branch=existing||repository.insert('knowledge_branches',{name,description,parent_id:parentId,slug:'mcp-'+createHash('sha256').update(name).digest('hex').slice(0,24),sort_order:0},user)
        const key='b:'+branch.id
        if(target===key)fail(400,'不能连接节点自身')
        if(target!==undefined) {
          if(!existing)db.prepare('DELETE FROM knowledge_connections WHERE source=? OR target=?').run(key,key)
          if(target!==null)db.prepare('INSERT OR IGNORE INTO knowledge_connections(source,target,created_by) VALUES(?,?,?)').run(...[key,target].sort(),user.id)
        }
        db.prepare('INSERT INTO mcp_node_creations(user_id,request_key,payload_hash,branch_id) VALUES(?,?,?,?)').run(user.id,input.request_key,payloadHash,branch.id)
        return {...branchResult(branch),reused:!!existing,...(existing?{message:'同级已有同名节点，已复用；创建者和说明保持原样。'}:{})}
      }
      const article=input.article_id&&repository.visibleArticle(input.article_id,user)
      if(!article || article.author_id!==user.id || article.visibility!=='public')fail(403,'普通账号创建分支需提供自己的公开文章或草稿 article_id，提交管理员审核')
      const names=[name],seen=new Set();let current=parentId
      while(current) {
        if(seen.has(current))fail(409,'上级分支层级异常，请联系管理员调整')
        seen.add(current)
        const branch=db.prepare('SELECT name,parent_id FROM knowledge_branches WHERE id=?').get(current)
        if(!branch)fail(404,'上级分支不存在')
        names.unshift(branch.name);current=branch.parent_id
      }
      const request=repository.insert('knowledge_branch_requests',{article_id:article.id,requested_path:names.join(' / '),requested_description:description,status:'pending'},user)
      db.prepare('INSERT INTO mcp_node_creations(user_id,request_key,payload_hash,request_id) VALUES(?,?,?,?)').run(user.id,input.request_key,payloadHash,request.id)
      return requestResult(request)
    })
  }
}
