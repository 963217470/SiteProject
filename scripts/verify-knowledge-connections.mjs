import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'

const db=new DatabaseSync(process.argv[2],{readOnly:true})
const before=process.argv[3]?new DatabaseSync(process.argv[3],{readOnly:true}):null
try {
  const schema=db.prepare('PRAGMA user_version').get().user_version
  assert.ok(schema>=11&&schema<=13)
  assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok')
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[])
  const keys=new Set(['root',...db.prepare('SELECT id FROM knowledge_branches').all().map(n=>'b:'+n.id),...db.prepare('SELECT id FROM articles WHERE kb_enabled=1').all().map(n=>'a:'+n.id)])
  const edges=db.prepare('SELECT source,target FROM knowledge_connections').all()
  for(const edge of edges)assert.ok(edge.source<edge.target&&keys.has(edge.source)&&keys.has(edge.target),'Dangling or invalid connection')
  if(before) {
    for(const [table,fields] of [['knowledge_branches','id,parent_id,name,description,created_by'],['articles','id,title,content,status,kb_enabled,kb_branch_id,author_id'],['knowledge_positions','node_id,x,y,pinned_by']]) {
      const id=table==='knowledge_positions'?'node_id':'id'
      const current=db.prepare(`SELECT ${fields} FROM ${table} WHERE ${id}=?`)
      for(const row of before.prepare(`SELECT ${fields} FROM ${table}`).all())assert.deepEqual(current.get(row[id]),row,'Migration changed existing '+table)
    }
    const legacy=[...before.prepare("SELECT 'b:'||id child,coalesce('b:'||parent_id,'root') parent FROM knowledge_branches").all(),...before.prepare("SELECT 'a:'||id child,coalesce('b:'||kb_branch_id,'root') parent FROM articles WHERE kb_enabled=1").all()]
    const existing=new Set(edges.map(e=>JSON.stringify([e.source,e.target])))
    for(const row of legacy)if(row.parent!==row.child)assert.ok(existing.has(JSON.stringify([row.parent,row.child].sort())),'Legacy connection lost')
  }
  console.log(JSON.stringify({schema,integrity:'ok',nodes:keys.size,connections:edges.length,backupVerified:Boolean(before)}))
} finally { before?.close();db.close() }
