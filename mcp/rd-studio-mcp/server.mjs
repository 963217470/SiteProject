import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { createRdServer } from './core.mjs'
import { uploadVideoNote, createUploadRequest } from './upload-note.mjs'

const configured = new URL(process.env.RD_STUDIO_URL || 'https://rd-studio.club')
if(configured.username||configured.password||configured.search||configured.hash||configured.pathname!=='/'||!(configured.protocol==='https:'||(configured.protocol==='http:'&&['localhost','127.0.0.1'].includes(configured.hostname))))throw new Error('RD_STUDIO_URL must be an HTTPS site origin (or localhost for testing).')
const siteUrl=configured.origin
async function readRows(table,query){
  const url=new URL('/api/data/'+table,siteUrl)
  for(const [key,value]of Object.entries(query))url.searchParams.set(key,String(value))
  const response=await fetch(url,{headers:{Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(15000)})
  if(!response.ok)throw new Error('RD STUDIO public API request failed: HTTP '+response.status)
  const rows=await response.json()
  if(!Array.isArray(rows))throw new Error('Invalid public API response')
  return rows
}
const token=process.env.RD_STUDIO_UPLOAD_TOKEN
const upload=token?createUploadRequest(siteUrl,token):undefined
const server=createRdServer({McpServer,z,readRows,siteUrl,upload,knowledgeWrite:process.env.RD_STUDIO_KNOWLEDGE_WRITE==='1'})
if(upload)server.registerTool('upload_video_note',{
  description:'读取 RD_STUDIO_NOTES_ROOT 内的本地 .md 笔记及相对图片（如 _assets），上传图片并替换路径，保存为本人草稿，返回检查链接。代码围栏内的图片示例不上传。更新需 id 和 expected_revision。',
  annotations:{readOnlyHint:false,destructiveHint:false,idempotentHint:true,openWorldHint:false},
  inputSchema:{note_path:z.string().min(1).max(2000),title:z.string().max(300).optional(),summary:z.string().max(10000).default(''),tags:z.array(z.string().max(100)).max(49).default([]),id:z.string().uuid().optional(),expected_revision:z.string().length(64).optional(),import_key:z.string().max(100).optional(),knowledge_branch_id:z.string().min(1).max(100).nullable().optional()}
},async args=>{
  try {
    const value=await uploadVideoNote(args,{root:process.env.RD_STUDIO_NOTES_ROOT,request:upload})
    return {content:[{type:'text',text:JSON.stringify(value,null,2)}],structuredContent:value}
  }catch(error){return {isError:true,content:[{type:'text',text:error.message}]}}
})
await server.connect(new StdioServerTransport())
async function shutdown(){await server.close();process.exit(0)}
process.on('SIGTERM',shutdown)
process.on('SIGINT',shutdown)
// stdout belongs exclusively to the MCP JSON-RPC protocol.
