// Run with `node --input-type=module < script` from the deployed server directory.
import assert from 'node:assert/strict'
import {randomUUID,randomBytes,createHash} from 'node:crypto'
import {Client} from '@modelcontextprotocol/sdk/client/index.js'
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import {openDatabase} from './database.mjs'
const db=openDatabase('/var/lib/rd-studio/site.sqlite')
const admins=db.prepare("SELECT id,username FROM profiles WHERE lower(username)='wind-celeste' AND role='admin'").all()
assert.equal(admins.length,1,'Exactly one authorized administrator is required')
const user=admins[0],id=randomUUID(),secret='rd_'+randomBytes(32).toString('base64url'),now=Date.now()
db.prepare('INSERT INTO mcp_tokens(id,user_id,name,token_hash,created_at,expires_at,allow_knowledge_write) VALUES(?,?,?,?,?,?,1)').run(id,user.id,'MCP node verification (temporary)',createHash('sha256').update(secret).digest('hex'),now,now+300000)
const client=new Client({name:'rd-live-node-verification',version:'1.2.0'})
try{
  await client.connect(new StreamableHTTPClientTransport(new URL('http://127.0.0.1:3100/api/mcp'),{requestInit:{headers:{Authorization:'Bearer '+secret}}}))
  const call=async(name,args)=>{
    const result=await client.callTool({name,arguments:args})
    assert.ok(!result.isError,JSON.stringify(result.content));return result.structuredContent
  }
  assert.equal((await client.listTools()).tools.length,10)
  const node=await call('create_knowledge_node',{request_key:'mcp-node-verification-20261015',name:'MCP 接入测试',description:'用于验证 AI 创建节点与写入草稿。测试草稿未发布，可由创建者删除测试节点。',parent_id:null})
  assert.equal(node.creator.id,user.id)
  const draft=await call('save_article_draft',{import_key:'mcp-note-verification-20261015',title:'MCP 节点创建与写作测试',markdown:'# MCP 节点创建与写作测试\n\n这是一篇自动接入验证草稿，尚未发布。\n\n## 公式\n\n$E=mc^2$\n\n## 代码\n\n```js\nconsole.log("RD STUDIO MCP");\n```',tags:['MCP','测试'],knowledge_branch_id:node.id})
  const saved=await call('get_own_draft',{id:draft.id})
  assert.equal(saved.knowledge_branch_id,node.id)
  assert.equal(db.prepare('SELECT status FROM articles WHERE id=?').get(draft.id).status,'draft')
  console.log(JSON.stringify({node_url:node.url,creator:node.creator.display_name,draft_id:draft.id,editor_url:draft.editor_url,status:'draft',protocol:'SDK Streamable HTTP',temporary_token:'revoked in finally'}))
}finally{
  db.prepare('UPDATE mcp_tokens SET revoked_at=? WHERE id=?').run(Date.now(),id)
  await client.close();db.close()
}
