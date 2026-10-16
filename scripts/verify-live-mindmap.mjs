import assert from 'node:assert/strict'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { uploadSchemas } from '../mcp/rd-studio-mcp/upload-tools.mjs'
import { z } from 'zod'

const base='http://127.0.0.1:3100'
assert.equal((await fetch(base+'/api/mindmaps/drafts/00000000-0000-4000-8000-000000000001')).status,401)
assert.equal((await fetch(base+'/api/mindmaps/drafts',{method:'POST',headers:{'X-RD-CSRF':'1','Content-Type':'application/json'},body:JSON.stringify({tree:{text:'read-only route check'}})})).status,401)
assert.ok(uploadSchemas(z).save_mindmap_draft.safeParse({import_key:'not-saved',tree:{text:'Schema check',children:[{text:'Child'}]}}).success)
const client=new Client({name:'mindmap-read-only-deployment-check',version:'1'})
try{
  await client.connect(new StreamableHTTPClientTransport(new URL(base+'/api/mcp')))
  const tools=(await client.listTools()).tools.map(tool=>tool.name)
  assert.equal(tools.length,5)
  assert.ok(!tools.includes('save_mindmap_draft'))
  const info=(await client.callTool({name:'get_site_info',arguments:{}})).structuredContent
  assert.equal(info.mindmap_url,'https://rd-studio.club/mindmap/')
  console.log('PASS: protected mindmap API, deployed tool schema, anonymous MCP remains read-only; no drafts created')
}finally{await client.close()}
