import { fail } from './repository.mjs'
import { formalMember } from './experience.mjs'
import {adminAudit} from './admin-audit.mjs'
import { randomUUID } from 'node:crypto'

export function installKnowledgeRoutes(app,repository,config) {
  const db=repository.db
  const now=config.now||Date.now
  function node(key,user) {
    if (key==='root') return {kind:'root'}
    if (typeof key!=='string' || key.length>110 || !/^[ba]:[A-Za-z0-9_-]+$/.test(key)) fail(400,'无效的知识节点')
    const id=key.slice(2)
    if (key.startsWith('b:')) {
      const branch=db.prepare('SELECT * FROM knowledge_branches WHERE id=?').get(id)
      if (!branch) fail(404,'分支不存在')
      return {...branch,kind:'branch'}
    }
    const article=repository.visibleArticle(id,user)
    if (!article || article.status!=='published' || !article.kb_enabled) fail(404,'知识库笔记不存在')
    return {...article,kind:'article'}
  }
  function admin(req) {
    if(!req.user)fail(401,'请先登录')
    if(req.user.role!=='admin')fail(403,'需要管理员权限才能修改知识图谱')
  }
  function pair(source,target,user) {
    node(source,user);node(target,user)
    if(source===target)fail(400,'不能连接节点自身')
    return [source,target].sort()
  }
  app.get('/api/knowledge/connections',(req,res)=>{
    const visible=new Set(['root',...db.prepare('SELECT id FROM knowledge_branches').all().map(b=>'b:'+b.id),...db.prepare("SELECT id FROM articles WHERE kb_enabled=1 AND status='published' AND (visibility='public' OR ?=1)").all(Number(Boolean(formalMember(db,req.user)))).map(a=>'a:'+a.id)])
    res.json({items:db.prepare('SELECT source,target FROM knowledge_connections ORDER BY source,target').all().filter(e=>visible.has(e.source)&&visible.has(e.target))})
  })
  app.post('/api/knowledge/branches',(req,res)=>{
    admin(req)
    const {name,description='',parent_id=null,connect_to=null,...extra}=req.body||{}
    if(Object.keys(extra).length||typeof name!=='string'||!name.trim()||name.trim().length>100||/[\\/\u0000-\u001f]/.test(name)||typeof description!=='string'||description.length>2000)fail(400,'请填写有效的分支名称和说明')
    const result=repository.transaction(()=>{
      if(parent_id!==null){if(typeof parent_id!=='string')fail(400,'无效的目录上级');node('b:'+parent_id,req.user)}
      if(connect_to!==null)node(connect_to,req.user)
      if(db.prepare('SELECT 1 FROM knowledge_branches WHERE parent_id IS ? AND name=?').get(parent_id,name.trim()))fail(409,'同一目录中已有同名节点')
      const branch=repository.insert('knowledge_branches',{name:name.trim(),description:description.trim(),parent_id,slug:randomUUID(),sort_order:0},req.user)
      const id='b:'+branch.id
      db.prepare('DELETE FROM knowledge_connections WHERE source=? OR target=?').run(id,id)
      if(connect_to!==null)db.prepare('INSERT INTO knowledge_connections(source,target,created_by) VALUES(?,?,?)').run(...pair(id,connect_to,req.user),req.user.id)
      return {id:branch.id,node_id:id,parent_id,connect_to}
    })
    res.status(201).json(result)
  })
  app.patch('/api/knowledge/nodes/:node/hierarchy',(req,res)=>{
    admin(req)
    const selected=node(req.params.node,req.user),{parent_id,...extra}=req.body||{}
    if(selected.kind!=='branch'||Object.keys(extra).length||!(parent_id===null||typeof parent_id==='string'))fail(400,'请选择有效的目录上级')
    if(parent_id!==null)node('b:'+parent_id,req.user)
    repository.mutate('knowledge_branches','PATCH',{parent_id},{id:'eq.'+selected.id},req.user)
    res.json({ok:true})
  })
  for(const method of ['put','delete'])app[method]('/api/knowledge/connections',(req,res)=>{
    admin(req)
    const {source,target,...extra}=req.body||{}
    if(Object.keys(extra).length)fail(400,'无效的连线参数')
    repository.transaction(()=>{
      const keys=pair(source,target,req.user)
      if(method==='put')db.prepare('INSERT OR IGNORE INTO knowledge_connections(source,target,created_by) VALUES(?,?,?)').run(...keys,req.user.id)
      else db.prepare('DELETE FROM knowledge_connections WHERE source=? AND target=?').run(...keys)
      adminAudit(db,req.user,method==='put'?'添加连线':'移除连线','knowledge',source,target,now())
    })
    res.json({ok:true})
  })
  app.get('/api/knowledge/creators',(req,res)=>{
    const rows=db.prepare("SELECT 'b:'||b.id node_id,b.created_by creator_id,b.created_at,p.username,p.full_name,p.avatar_url FROM knowledge_branches b LEFT JOIN profiles p ON p.id=b.created_by UNION ALL SELECT 'a:'||a.id,a.author_id,a.created_at,p.username,p.full_name,p.avatar_url FROM articles a LEFT JOIN profiles p ON p.id=a.author_id WHERE a.kb_enabled=1 AND a.status='published' AND (a.visibility='public' OR ?=1)").all(Number(Boolean(formalMember(db,req.user))))
    res.json({items:rows.map(row=>({node_id:row.node_id,created_at:row.created_at,creator:row.username?{id:row.creator_id,username:row.username,display_name:row.full_name||row.username,avatar_url:row.avatar_url||null}:null}))})
  })
  app.get('/api/knowledge/positions',(req,res)=>{
    const items=db.prepare('SELECT node_id,x,y,updated_at FROM knowledge_positions').all().filter(position=>{
      try{node(position.node_id,req.user);return true}catch(error){if(error.status===404)return false;throw error}
    })
    res.json({items})
  })
  app.put('/api/knowledge/nodes/:node/position',(req,res)=>{
    admin(req)
    const {x,y,...extra}=req.body||{}
    if(Object.keys(extra).length || typeof x!=='number' || typeof y!=='number' || !Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x)>1000000 || Math.abs(y)>1000000)fail(400,'无效的节点坐标')
    const updated_at=new Date(now()).toISOString()
    repository.transaction(()=>{
      node(req.params.node,req.user)
      db.prepare('INSERT INTO knowledge_positions(node_id,x,y,pinned_by,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(node_id) DO UPDATE SET x=excluded.x,y=excluded.y,pinned_by=excluded.pinned_by,updated_at=excluded.updated_at').run(req.params.node,x,y,req.user.id,updated_at)
      adminAudit(db,req.user,'保存节点中心','knowledge',req.params.node,JSON.stringify({x,y}),now())
    })
    res.json({node_id:req.params.node,x,y,updated_at})
  })
  app.delete('/api/knowledge/nodes/:node/position',(req,res)=>{
    admin(req)
    repository.transaction(()=>{node(req.params.node,req.user);db.prepare('DELETE FROM knowledge_positions WHERE node_id=?').run(req.params.node);adminAudit(db,req.user,'取消固定','knowledge',req.params.node,'',now())})
    res.json({ok:true})
  })
  app.delete('/api/knowledge/nodes/:node',(req,res)=>{
    if(!req.user)fail(401,'请先登录')
    const result=repository.transaction(()=>{
      const selected=node(req.params.node,req.user)
      if(selected.kind==='root')fail(400,'知识库根节点不能删除')
      const owner=selected.kind==='branch'?selected.created_by:selected.author_id
      if(req.user.role!=='admin' && owner!==req.user.id)fail(403,'只能删除自己创建的节点')
      adminAudit(db,req.user,'删除节点','knowledge',req.params.node,selected.name||selected.title,now())
      if(selected.kind==='branch') {
        const parent=selected.parent_id
        repository.deleteBranch(selected)
        return {kind:'branch',removed:req.params.node,parent:parent?'b:'+parent:'root'}
      }
      db.prepare('UPDATE articles SET kb_enabled=0,kb_branch_id=NULL,updated_at=? WHERE id=?').run(new Date(now()).toISOString(),selected.id)
      return {kind:'article',removed:req.params.node,parent:selected.kb_branch_id?'b:'+selected.kb_branch_id:'root'}
    })
    res.json(result)
  })
}
