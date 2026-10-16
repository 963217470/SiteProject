import express from 'express'
import { rateLimit } from 'express-rate-limit'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import { createRdServer } from '../mcp/rd-studio-mcp/core.mjs'
import { uploadSchemas } from '../mcp/rd-studio-mcp/upload-tools.mjs'
import { createNoteUpload } from './note-upload.mjs'
import { createKnowledgeWriter } from './mcp-knowledge.mjs'
import { mindmapDraft } from '../mcp/rd-studio-mcp/mindmap.mjs'
import { importTextDraft } from '../mcp/rd-studio-mcp/text-draft.mjs'

export function installMcpRoutes(app,repository,config){
  const siteUrl=new URL(config.siteUrl).origin
  const rate=rateLimit({windowMs:60000,limit:120,standardHeaders:'draft-8',legacyHeaders:false})
  const notes=createNoteUpload(repository,config)
  const createNode=createKnowledgeWriter(repository,config)
  const operations=(user,name,input)=>{
    if(name==='get_upload_identity')return notes.identity(user)
    if(name==='get_own_draft')return notes.getDraft(user,input.id)
    if(name==='save_article_draft')return notes.saveDraft(user,input)
    if(name==='import_text_draft')return importTextDraft(notes,user,input)
    if(name==='save_mindmap_draft') {
      try{return mindmapDraft(notes,user,input,siteUrl)}catch(error){if(!error.status)error.status=400;throw error}
    }
    if(name==='upload_note_image')return notes.uploadImage(user,input)
    if(name==='create_knowledge_node')return createNode(user,input)
    throw Object.assign(new Error('上传接口不存在'),{status:404})
  }
  const originGuard=(req,res,next)=>{
    if(req.get('origin')&&req.get('origin')!==siteUrl)return res.status(403).json({message:'Invalid MCP Origin'})
    if(req.get('sec-fetch-site')==='cross-site')return res.status(403).json({message:'Cross-site MCP requests are not accepted'})
    next()
  }
  // These bearer-only routes never authorize writes using browser cookies.
  app.post('/api/note-upload/:tool',rate,originGuard,express.json({limit:'10mb'}),async(req,res)=>{
    const user=notes.authenticate(req)
    if(!user)return res.status(401).json({message:'需要上传令牌'})
    const schemas=uploadSchemas(z)
    if(!Object.hasOwn(schemas,req.params.tool))return res.status(404).json({message:'上传接口不存在'})
    const schema=schemas[req.params.tool]
    const parsed=schema.safeParse(req.body)
    if(!parsed.success)return res.status(400).json({message:'上传参数无效'})
    res.json(await operations(user,req.params.tool,parsed.data))
  })
  app.all('/api/mcp',rate,(req,res,next)=>{
    if(req.get('origin')&&req.get('origin')!==siteUrl)return res.status(403).json({message:'Invalid MCP Origin'})
    if(req.get('sec-fetch-site')==='cross-site')return res.status(403).json({message:'Cross-site MCP requests are not accepted'})
    if(req.method!=='POST')return res.status(405).set('Allow','POST').end()
    next()
  },express.json({limit:'10mb'}),async(req,res,next)=>{
    const user=notes.authenticate(req)
    const server=createRdServer({McpServer,z,siteUrl,readRows:async(table,query)=>repository.query(table,query,null),upload:user?(name,input)=>operations(user,name,input):undefined,knowledgeWrite:!!user?.allow_knowledge_write})
    const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true,enableDnsRebindingProtection:true,allowedOrigins:[siteUrl],allowedHosts:[new URL(siteUrl).host,'127.0.0.1:'+req.socket.localPort,'localhost:'+req.socket.localPort]})
    res.on('close',()=>{void server.close().catch(()=>{})})
    try{await server.connect(transport);await transport.handleRequest(req,res,req.body)}catch(error){if(!res.headersSent)next(error)}
  })
}
