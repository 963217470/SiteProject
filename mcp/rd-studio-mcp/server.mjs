import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { createRdServer } from './core.mjs'

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
const server=createRdServer({McpServer,z,readRows,siteUrl})
await server.connect(new StdioServerTransport())
async function shutdown(){await server.close();process.exit(0)}
process.on('SIGTERM',shutdown)
process.on('SIGINT',shutdown)
// stdout belongs exclusively to the MCP JSON-RPC protocol.
