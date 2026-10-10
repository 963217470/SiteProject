import { randomUUID } from 'node:crypto'
import { fail } from './repository.mjs'
import { creditTaskReading } from './tasks.mjs'
import { creditDailyReading } from './community.mjs'

export function installReadingRoutes(app, db, repository, now = Date.now) {
  app.use('/api/reading', (req, _res, next) => req.user ? next() : next(Object.assign(new Error('请先登录'), { status: 401 })))
  const readable = (id, user) => repository.query('articles', { id: 'eq.' + id, limit: 1 }, user)[0]
  app.post('/api/reading/start', (req, res) => {
    const id = req.body?.article_id
    if (typeof id !== 'string' || id.length > 100) fail(400, '无效的文章')
    if (!readable(id, req.user)) fail(404, '文章不存在或无权访问')
    const time = now()
    const sessionId = randomUUID()
    repository.transaction(() => {
      db.prepare('DELETE FROM reading_sessions WHERE last_seen<?').run(time - 120000)
      db.prepare('INSERT INTO reading_history(user_id,article_id,last_read_at) VALUES(?,?,?) ON CONFLICT(user_id,article_id) DO UPDATE SET last_read_at=excluded.last_read_at').run(req.user.id, id, new Date(time).toISOString())
      db.prepare('INSERT INTO reading_sessions(id,user_id,article_id,last_seen) VALUES(?,?,?,?)').run(sessionId, req.user.id, id, time)
      db.prepare('INSERT INTO reading_clock(user_id,last_tick) VALUES(?,?) ON CONFLICT(user_id) DO NOTHING').run(req.user.id, time)
    })
    res.status(201).json({ id: sessionId })
  })
  app.post('/api/reading/:id/tick', (req, res) => {
    if (typeof req.body?.active !== 'boolean' || (req.body.closed !== undefined && typeof req.body.closed !== 'boolean')) fail(400, '无效的阅读状态')
    const result = repository.transaction(() => {
      const session = db.prepare('SELECT * FROM reading_sessions WHERE id=? AND user_id=?').get(req.params.id, req.user.id)
      if (!session) fail(404, '阅读会话已结束')
      if (!readable(session.article_id, req.user)) fail(404, '文章不可访问')
      const time = now()
      const clock = db.prepare('SELECT last_tick FROM reading_clock WHERE user_id=?').get(req.user.id)
      const elapsed = time - session.last_seen
      // A shared user clock prevents parallel tabs from multiplying credited time.
      const credit = req.body.active && session.active && !req.body.closed && elapsed >= 0 && elapsed <= 30000
        ? Math.max(0, Math.min(20, Math.floor((time - Math.max(clock.last_tick, session.last_seen)) / 1000))) : 0
      db.prepare('UPDATE reading_clock SET last_tick=? WHERE user_id=?').run(time, req.user.id)
      if (req.body.active) db.prepare('UPDATE reading_history SET seconds=seconds+?,last_read_at=? WHERE user_id=? AND article_id=?').run(credit, new Date(time).toISOString(), req.user.id, session.article_id)
      creditTaskReading(db, req.user.id, session.article_id, credit, time)
      creditDailyReading(db, req.user.id, session.article_id, credit, time)
      if (req.body.closed) db.prepare('DELETE FROM reading_sessions WHERE id=?').run(session.id)
      else db.prepare('UPDATE reading_sessions SET last_seen=?,active=? WHERE id=?').run(time, req.body.active ? 1 : 0, session.id)
      return { credited_seconds: credit }
    })
    res.json(result)
  })
  app.get('/api/reading/history', (req, res) => {
    const offset = Number(req.query.offset || 0)
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) fail(400, '无效的页码')
    const rows = db.prepare('SELECT * FROM reading_history WHERE user_id=? ORDER BY last_read_at DESC,article_id LIMIT 51 OFFSET ?').all(req.user.id, offset)
    const items = rows.slice(0, 50).map(row => {
      const article = readable(row.article_id, req.user)
      return article ? { id: article.id, title: article.title, summary: article.summary, cover_url: article.cover_url, viewed_at: row.last_read_at, reading_seconds: row.seconds } : null
    }).filter(Boolean)
    res.json({ items, has_more: rows.length > 50 })
  })
  app.delete('/api/reading/history', (req, res) => {
    const id = req.body?.article_id
    if (id !== undefined && (typeof id !== 'string' || !id.length || id.length > 100)) fail(400, '无效的文章')
    repository.transaction(() => {
      for (const table of ['reading_history', 'reading_sessions']) {
        const sql = `DELETE FROM ${table} WHERE user_id=?${id ? ' AND article_id=?' : ''}`
        db.prepare(sql).run(...(id ? [req.user.id, id] : [req.user.id]))
      }
    })
    res.json({ ok: true })
  })
}
