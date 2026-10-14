export function uploadSchemas(z) {
  return {
    get_upload_identity:z.object({}).strict(),
    get_own_draft:z.object({id:z.string().uuid()}).strict(),
    save_article_draft:z.object({
      id:z.string().uuid().optional(),expected_revision:z.string().length(64).optional(),
      import_key:z.string().min(1).max(100).optional(),title:z.string().min(1).max(300),
      markdown:z.string().min(1).max(2000000),summary:z.string().max(10000).default(''),
      tags:z.array(z.string().min(1).max(100)).max(50).default([])
    }).strict(),
    upload_note_image:z.object({base64:z.string().min(1).max(6990508)}).strict()
  }
}

export function registerUploadTools(server,z,operations) {
  const descriptions={
    get_upload_identity:'确认上传令牌对应的本人账号和有限上传权限。',
    get_own_draft:'读取本人尚未提交审核的公开草稿，返回 Markdown 和 revision；更新前请读取。',
    save_article_draft:'创建或更新本人公开草稿，不能发布。新建需稳定 import_key，更新需 id 和最新 expected_revision；返回文章预览和编辑链接。',
    upload_note_image:'上传 5MB 内 PNG/JPEG/WebP/GIF/AVIF 图片的 Base64，返回站内图片 URL。相同图片复用；未公开草稿图片仅作者和管理员可见。'
  }
  for(const [name,schema] of Object.entries(uploadSchemas(z))) {
    server.registerTool(name,{description:descriptions[name],inputSchema:schema.shape,
      annotations:{readOnlyHint:name.startsWith('get_'),destructiveHint:false,idempotentHint:true,openWorldHint:false}},async input=>{
      try {
        const value=await operations(name,schema.parse(input))
        return {content:[{type:'text',text:JSON.stringify(value,null,2)}],structuredContent:value}
      } catch(error) {
        return {isError:true,content:[{type:'text',text:error.status>=500?'上传服务暂不可用':error.message}]}
      }
    })
  }
}
