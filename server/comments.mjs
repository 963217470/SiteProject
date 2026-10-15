import { randomUUID } from 'node:crypto'
import { fail } from './repository.mjs'
import {adminAudit} from './admin-audit.mjs'

export function installCommentRoutes(app, db, repository, now = Date.now) {
  const requireUser = req => { if (!req.user) fail(401, '请先登录') }
  const admin = req => { requireUser(req); if (req.user.role !== 'admin') fail(403, '需要管理员权限') }
  const offset = req => {
    const value = Number(req.query.offset || 0)
    if (!Number.isSafeInteger(value) || value < 0 || value > 100000) fail(400, '页码无效')
    return value
  }
  app.get('/api/comments', (req, res) => {
    const article = repository.visibleArticle(req.query.article_id, req.user)
    if (!article) fail(404, '文章不存在')
    const rows = db.prepare(`SELECT c.*,p.username,p.avatar_url,pp.username parent_username FROM comments c JOIN profiles p ON p.id=c.user_id LEFT JOIN comments parent ON parent.id=c.parent_id LEFT JOIN profiles pp ON pp.id=parent.user_id
      WHERE c.article_id=? AND (c.status='approved' OR c.user_id=?) AND (c.parent_id IS NULL OR parent.status='approved') ORDER BY c.created_at,c.rowid LIMIT 51 OFFSET ?`).all(article.id, req.user?.id || '', offset(req))
    res.json({ items: rows.slice(0, 50), has_more: rows.length > 50 })
  })
  app.post('/api/comments', (req, res) => {
    requireUser(req)
    const article = repository.visibleArticle(req.body?.article_id, req.user)
    if (!article || article.status !== 'published') fail(404, '文章未发布或不存在')
    const content = req.body?.content, parent = req.body?.parent_id ?? null
    if (typeof content !== 'string' || !content.trim() || content.length > 10000) fail(400, '评论需要 1 至 10000 字')
    if (parent !== null && (typeof parent !== 'string' || !db.prepare("SELECT 1 FROM comments WHERE id=? AND article_id=? AND status='approved'").get(parent, article.id))) fail(400, '回复的评论不可用')
    const result = repository.transaction(() => {
      const id = randomUUID()
      db.prepare('INSERT INTO comments(id,article_id,user_id,content,parent_id,created_at) VALUES(?,?,?,?,?,?)').run(id, article.id, req.user.id, content.trim(), parent, new Date(now()).toISOString())
      return { id, status: 'pending' }
    })
    res.status(201).json(result)
  })
  app.get('/api/comments/reviews', (req, res) => {
    admin(req)
    const status = req.query.status || 'pending'
    if (!['pending','approved','rejected'].includes(status)) fail(400, '审核状态无效')
    const rows = db.prepare('SELECT c.*,p.username,a.title FROM comments c JOIN profiles p ON p.id=c.user_id JOIN articles a ON a.id=c.article_id WHERE c.status=? ORDER BY c.created_at DESC,c.rowid DESC LIMIT 31 OFFSET ?').all(status, offset(req))
    res.json({ items: rows.slice(0, 30), has_more: rows.length > 30 })
  })
  app.post('/api/comments/:id/review', (req, res) => {
    admin(req)
    repository.transaction(() => {
      const row = db.prepare('SELECT * FROM comments WHERE id=?').get(req.params.id)
      const approved = req.body?.approved, note = req.body?.note || ''
      if (!row || (row.status !== 'pending' && !(row.status === 'approved' && approved === false))) fail(409, '评论已处理或不存在')
      if (typeof approved !== 'boolean' || typeof note !== 'string' || note.length > 1000 || !approved && !note.trim()) fail(400, '请填写有效的审核说明')
      if (approved && row.parent_id && db.prepare('SELECT status FROM comments WHERE id=?').get(row.parent_id)?.status !== 'approved') fail(409, '被回复的评论已下架')
      db.prepare('UPDATE comments SET status=?,review_note=?,reviewed_by=?,reviewed_at=? WHERE id=?').run(approved ? 'approved' : 'rejected', note.trim(), req.user.id, now(), row.id)
      adminAudit(db,req.user,'评论审核','comment',row.id,approved?'通过':note.trim(),now())
      if (!approved) db.prepare("WITH RECURSIVE replies(id) AS (SELECT id FROM comments WHERE parent_id=? UNION ALL SELECT c.id FROM comments c JOIN replies r ON c.parent_id=r.id) UPDATE comments SET status='rejected',review_note=?,reviewed_by=?,reviewed_at=? WHERE id IN (SELECT id FROM replies) AND status<>'rejected'").run(row.id, '所属评论已下架：' + note.trim(), req.user.id, now())
    })
    res.json({ ok: true })
  })
}
