import { fail } from './repository.mjs'
import { formalMember } from './experience.mjs'
import {adminAudit} from './admin-audit.mjs'

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
    if(req.user.role!=='admin')fail(403,'只有管理员可以固定或取消固定节点位置')
  }
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
