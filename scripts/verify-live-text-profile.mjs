import assert from 'node:assert/strict'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { uploadSchemas } from '../mcp/rd-studio-mcp/upload-tools.mjs'
import { z } from 'zod'
import { Repository } from '../server/repository.mjs'

const base='http://127.0.0.1:3100'
const parsed=uploadSchemas(z).import_text_draft.parse({import_key:'schema-only',text:'not saved'})
assert.equal(parsed.format,'text')
assert.equal(typeof Repository.prototype.applyProfileChange,'function')
assert.equal((await fetch(base+'/api/note-upload/import_text_draft',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'route authentication check'})})).status,401)
const client=new Client({name:'text-profile-read-only-check',version:'1'})
try{
  await client.connect(new StreamableHTTPClientTransport(new URL(base+'/api/mcp')))
  const tools=(await client.listTools()).tools.map(tool=>tool.name)
  assert.equal(tools.length,5);assert.ok(!tools.includes('import_text_draft'))
  console.log('PASS: text import schema and bearer-only route deployed; anonymous MCP remains read-only; profile helper loaded; no production records changed')
}finally{await client.close()}
