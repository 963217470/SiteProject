import { z } from 'zod'
import { uploadSchemas } from '../mcp/rd-studio-mcp/upload-tools.mjs'
import { mindmapDraft } from '../mcp/rd-studio-mcp/mindmap.mjs'
import { createNoteUpload } from './note-upload.mjs'
import { fail } from './repository.mjs'

export function installMindmapRoutes(app, repository, config) {
  const notes = createNoteUpload(repository, config)
  const requireUser = (req, _res, next) => req.user ? next() : next(Object.assign(new Error('请先登录后保存导图'), { status: 401 }))
  app.get('/api/mindmaps/drafts/:id', requireUser, (req, res) => res.json(notes.getDraft(req.user, req.params.id)))
  app.post('/api/mindmaps/drafts', requireUser, (req, res) => {
    const parsed = uploadSchemas(z).save_mindmap_draft.safeParse(req.body)
    if (!parsed.success) fail(400, '导图参数无效')
    try { res.json(mindmapDraft(notes, req.user, parsed.data, config.siteUrl)) }
    catch (error) { if (!error.status) error.status = 400; throw error }
  })
}
