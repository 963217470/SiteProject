import express from 'express'
import { rateLimit } from 'express-rate-limit'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import { createRdServer } from '../mcp/rd-studio-mcp/core.mjs'

export function installMcpRoutes(app,repository,config){
  const siteUrl=new URL(config.siteUrl).origin
  const rate=rateLimit({windowMs:60000,limit:120,standardHeaders:'draft-8',legacyHeaders:false})
  // This one public read-only endpoint uses MCP authentication semantics, not browser cookie writes.
  app.all('/api/mcp',rate,(req,res,next)=>{
    if(req.get('origin')&&req.get('origin')!==siteUrl)return res.status(403).json({message:'Invalid MCP Origin'})
    if(req.get('sec-fetch-site')==='cross-site')return res.status(403).json({message:'Cross-site MCP requests are not accepted'})
    if(req.method!=='POST')return res.status(405).set('Allow','POST').end()
    next()
  },express.json({limit:'128kb'}),async(req,res,next)=>{
    const server=createRdServer({McpServer,z,siteUrl,readRows:async(table,query)=>repository.query(table,query,null)})
    const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true,enableDnsRebindingProtection:true,allowedOrigins:[siteUrl],allowedHosts:[new URL(siteUrl).host,'127.0.0.1:'+req.socket.localPort,'localhost:'+req.socket.localPort]})
    res.on('close',()=>{void server.close().catch(()=>{})})
    try{await server.connect(transport);await transport.handleRequest(req,res,req.body)}catch(error){if(!res.headersSent)next(error)}
  })
}
