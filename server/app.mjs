import express from 'express'
import session from 'express-session'
import helmet from 'helmet'
import { rateLimit } from 'express-rate-limit'
import { Passport } from 'passport'
import { Strategy as GitHubStrategy } from 'passport-github2'
import { randomUUID } from 'node:crypto'
import { mkdirSync, createWriteStream } from 'node:fs'
import { open, unlink } from 'node:fs/promises'
import { join, basename } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Transform } from 'node:stream'
import { fileTypeFromBuffer } from 'file-type'
import { SQLiteSessionStore } from './database.mjs'
import { Repository, fail } from './repository.mjs'
import { experience, formalMember, formalThreshold } from './experience.mjs'
import { installReadingRoutes } from './reading.mjs'
import { installTaskRoutes } from './tasks.mjs'
import { installCatalogRoutes, catalogFileVisible } from './catalog.mjs'
import { flushCommunity, installCommunityRoutes } from './community.mjs'
import { installCommentRoutes } from './comments.mjs'
import { installMcpRoutes } from './mcp.mjs'
import { installNoteTokenRoutes } from './note-upload.mjs'
import { installKnowledgeRoutes } from './knowledge.mjs'
import { installAdminDashboard } from './admin-dashboard.mjs'
import { installActivityRoutes } from './activity.mjs'
import { installMindmapRoutes } from './mindmaps.mjs'
import { acceptBindingIdentity, installBindingRoutes } from './account-binding.mjs'
import { flushCurrency, installShopRoutes } from './shop.mjs'

const rasterTypes = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif'])
const buckets = new Set(['avatars', 'resources', 'internal', 'task-evidence', 'catalog','notes'])

export function createApp(db, config) {
  const app = express()
  const repository = new Repository(db)
  const now = config.now || Date.now
  db.function('rd_now', now)
  repository.onCommit = () => { flushCommunity(db, now); flushCurrency(db, now) }
  const passport = new Passport()
  const uploadDir = join(config.dataDir, 'uploads')
  mkdirSync(uploadDir, { recursive: true, mode: 0o700 })
  app.disable('x-powered-by')
  app.set('trust proxy', 'loopback')
  app.set('query parser', 'simple')
  app.use(helmet({ contentSecurityPolicy: false }))
  app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next() })
  app.use('/api', rateLimit({ windowMs: 60000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }))
  app.use(session({
    name: 'rd.sid', secret: config.sessionSecret, store: new SQLiteSessionStore(db),
    resave: false, saveUninitialized: false,
    cookie: { httpOnly: true, secure: config.production, sameSite: 'lax', maxAge: 7 * 86400000 }
  }))
  passport.serializeUser((user, done) => done(null, user.id))
  passport.deserializeUser((id, done) => {
    try { done(null, db.prepare('SELECT p.*,u.email,u.github_id FROM profiles p JOIN users u ON u.id=p.id WHERE p.id=?').get(id) || false) }
    catch (error) { done(error) }
  })
  if (config.githubClientId && config.githubClientSecret) {
    const githubStrategy = new GitHubStrategy({
      clientID: config.githubClientId, clientSecret: config.githubClientSecret,
      callbackURL: config.siteUrl + '/api/auth/github/callback', state: true, passReqToCallback: true
    }, (req, _token, _refresh, profile, done) => {
      try {
        if (req.session.githubBindingOAuth) {
          acceptBindingIdentity(db, req.session, req.user, profile, now(), config.adminGithubIds)
          return done(null, { id: req.user.id }, { binding: true })
        }
        const user = repository.transaction(() => {
          const existing = db.prepare('SELECT id FROM users WHERE github_id=?').get(profile.id)
          const id = existing?.id || randomUUID()
          const avatar = profile.photos?.[0]?.value || ''
          const email = profile.emails?.[0]?.value || null
          db.prepare('INSERT INTO users(id,github_id,email,github_username,full_name,avatar_url) VALUES(?,?,?,?,?,?) ON CONFLICT(github_id) DO UPDATE SET email=excluded.email,github_username=excluded.github_username,full_name=excluded.full_name,avatar_url=excluded.avatar_url').run(id, profile.id, email, profile.username, profile.displayName || '', avatar)
          db.prepare('INSERT INTO profiles(id,username,full_name,avatar_url,role) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING').run(id, profile.username, profile.displayName || '', avatar, config.adminGithubIds.includes(profile.id) ? 'admin' : 'user')
          if (config.adminGithubIds.includes(profile.id)) db.prepare("UPDATE profiles SET role='admin' WHERE id=?").run(id)
          return { id }
        })
        done(null, user)
      } catch (error) { done(error) }
    })
    const authorizationParams = githubStrategy.authorizationParams.bind(githubStrategy)
    githubStrategy.authorizationParams = options => ({ ...authorizationParams(options), ...(options.prompt ? { prompt: options.prompt } : {}) })
    passport.use(githubStrategy)
  }
  app.use(passport.initialize())
  app.use(passport.session())
  installMcpRoutes(app,repository,config)
  app.use('/api', (req, _res, next) => {
    if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
      if (req.get('x-rd-csrf') !== '1' || (req.get('origin') && req.get('origin') !== config.siteUrl) || req.get('sec-fetch-site') === 'cross-site') {
        return next(Object.assign(new Error('请求来源无效'), { status: 403 }))
      }
    }
    next()
  })
  const parseJson = express.json({ limit: '3mb' })
  app.use((req,res,next) => req.method === 'POST' && req.path.startsWith('/api/storage/') ? next() : parseJson(req,res,next))
  app.use('/api', (_req, _res, next) => { try { repository.transaction(() => {}); next() } catch (error) { next(error) } })
  installNoteTokenRoutes(app,repository,config)
  installMindmapRoutes(app,repository,config)
  installKnowledgeRoutes(app,repository,config)
  installCommunityRoutes(app, db, repository, now)
  installCommentRoutes(app, db, repository, now)
  installReadingRoutes(app, db, repository, config.now || Date.now)
  installTaskRoutes(app, db, repository, config.now || Date.now)
  installCatalogRoutes(app, db, repository, config)
  installShopRoutes(app, db, repository, now, config.shopRedemptionsEnabled === true)
  app.get('/api/health', (_req, res) => { db.prepare('SELECT 1').get(); res.json({ ok: true, version: 1 }) })
  app.get('/api/auth/settings', (_req, res) => res.json({ github: Boolean(config.githubClientId && config.githubClientSecret) }))
  app.get('/api/auth/session', (req, res) => {
    const user = req.user
    res.json({ session: user ? { user: {
      id: user.id, email: user.email || '',
      user_metadata: { user_name: user.username, full_name: user.full_name, avatar_url: user.avatar_url },
      app_metadata: { role: user.role }
    } } : null })
  })
  const oauthLimit = rateLimit({ windowMs: 60000, limit: 15, standardHeaders: 'draft-8', legacyHeaders: false })
  installBindingRoutes(app, db, repository, passport, config, oauthLimit, now)
  app.get('/api/auth/github', oauthLimit, (req, res, next) => {
    if (!config.githubClientId || !config.githubClientSecret) return res.status(503).json({ message: 'GitHub 登录暂不可用' })
    delete req.session.githubBinding
    delete req.session.githubBindingOAuth
    passport.authenticate('github', { scope: ['user:email'] })(req, res, next)
  })
  app.get('/api/auth/github/callback', oauthLimit, (req, res, next) => {
    if (!config.githubClientId || !config.githubClientSecret) return res.redirect('/login?error=github_unavailable')
    const binding = Boolean(req.session.githubBindingOAuth)
    passport.authenticate('github', (error, user, info) => {
      if (binding) {
        delete req.session.githubBindingOAuth
        if (error || !user || !info?.binding) {
          delete req.session.githubBinding
          return req.session.save(saveError => saveError ? next(saveError) : res.redirect('/user/profile?tab=security&binding=failed'))
        }
        return req.session.save(saveError => saveError ? next(saveError) : res.redirect('/user/profile?tab=security'))
      }
      if (error) return next(error)
      if (!user) return res.redirect('/login?error=github_auth_failed')
      req.logIn(user, loginError => {
        if (loginError) return next(loginError)
        req.session.save(saveError => saveError ? next(saveError) : res.redirect('/auth/callback'))
      })
    })(req, res, next)
  })
  app.post('/api/auth/logout', (req, res, next) => {
    req.logout(error => {
      if (error) return next(error)
      req.session.destroy(error => {
        if (error) return next(error)
        res.clearCookie('rd.sid', { httpOnly: true, secure: config.production, sameSite: 'lax' })
        res.json({ ok: true })
      })
    })
  })

  app.all('/api/data/:table', (req, res) => {
    const table = req.params.table
    const { method, user } = req
    repository.columns(table)
    repository.project(table, [], req.query.select || '*')
    let rows
    if (method === 'GET' || method === 'HEAD') rows = repository.query(table, req.query, user)
    else if (method === 'POST') rows = repository.transaction(() => [repository.insert(table, req.body, user)])
    else if (['PATCH', 'DELETE'].includes(method)) rows = repository.mutate(table, method, req.body, req.query, user)
    else fail(405, '请求方法不支持')
    if (req.get('Prefer')?.includes('count=')) {
      const countQuery = { ...req.query, limit: undefined, offset: undefined }
      const count = repository.query(table, countQuery, user, 'read', true)
      res.set('Content-Range', `0-${Math.max(0, rows.length - 1)}/${count}`)
    }
    const result = repository.project(table, rows, req.query.select || '*')
    if (req.get('Accept')?.includes('application/vnd.pgrst.object+json')) {
      if (result.length !== 1) return res.status(406).json({ message: '没有找到唯一记录', code: 'PGRST116' })
      return res.json(result[0])
    }
    res.json(result)
  })

  function fileLocation(req) {
    const { bucket } = req.params
    const path = req.params.path.join('/')
    if (!buckets.has(bucket) || !path || path.length > 500 || path.split('/').some(part => !part || part === '.' || part === '..' || /[\\\u0000-\u001f]/.test(part))) fail(400, '无效的文件路径')
    return { bucket, path }
  }
  app.post('/api/storage/:bucket/*path', async (req, res) => {
    if (!req.user) fail(401, '请先登录')
    const { bucket, path } = fileLocation(req)
    if (bucket === 'notes') fail(403,'笔记图片请使用上传令牌接口')
    if (bucket === 'resources' && req.user.role !== 'admin') fail(403, '需要管理员权限')
    if (bucket === 'internal' && !formalMember(db,req.user)) fail(403, '需要正式社员权限')
    if (['task-evidence','catalog'].includes(bucket) && db.prepare('SELECT coalesce(sum(size),0) n FROM files WHERE owner_id=? AND bucket=?').get(req.user.id,bucket).n >= 500 * 1024 * 1024) fail(413, '文件存储已达上限')
    const parts = path.split('/')
    if (parts[0] !== req.user.id && !(['avatars', 'article-images', 'article-attachments'].includes(parts[0]) && parts[1] === req.user.id)) fail(403, '只能上传自己的文件')
    if (db.prepare('SELECT id FROM files WHERE bucket=? AND path=?').get(bucket, path)) fail(409, '文件已存在')
    const id = randomUUID()
    const file = join(uploadDir, id)
    let size = 0
    const maxBytes = bucket === 'avatars' ? 2 * 1024 * 1024 : config.maxUploadMb * 1024 * 1024
    if (Number(req.get('content-length')) > maxBytes) fail(413, '文件过大')
    const limiter = new Transform({ transform(chunk, _encoding, callback) {
      size += chunk.length
      callback(size > maxBytes ? Object.assign(new Error('文件过大'), { status: 413 }) : null, chunk)
    } })
    try {
      await pipeline(req, limiter, createWriteStream(file, { flags: 'wx', mode: 0o600 }))
      if (bucket === 'catalog' && !size) fail(400,'不能上传空文件')
      const handle = await open(file, 'r')
      let buffer
      try { const result = await handle.read(Buffer.alloc(Math.min(size, 4100)), 0, Math.min(size, 4100), 0); buffer = result.buffer.subarray(0, result.bytesRead) }
      finally { await handle.close() }
      const type = size ? await fileTypeFromBuffer(buffer).catch(() => null) : null
      const mime = type && rasterTypes.has(type.mime) ? type.mime : 'application/octet-stream'
      if (bucket === 'avatars' && (mime === 'application/octet-stream' || !size)) fail(400, '头像需要是 2MB 以内的 PNG、JPEG、GIF、WebP 或 AVIF 图片')
      repository.transaction(() => {
        if (['task-evidence','catalog'].includes(bucket) && db.prepare('SELECT coalesce(sum(size),0) n FROM files WHERE owner_id=? AND bucket=?').get(req.user.id,bucket).n + size > 500 * 1024 * 1024) fail(413, '文件存储已达上限')
        db.prepare('INSERT INTO files(id,bucket,path,owner_id,mime,size) VALUES(?,?,?,?,?,?)').run(id, bucket, path, req.user.id, mime, size)
      })
      res.status(201).json({ path, id, mime, size })
    } catch (error) { await unlink(file).catch(() => {}); throw error }
  })
  app.get('/api/files/:bucket/*path', (req, res) => {
    const { bucket, path } = fileLocation(req)
    if (['resources', 'internal'].includes(bucket) && !formalMember(db,req.user)) fail(req.user ? 403 : 401, '需要正式社员权限')
    const file = db.prepare('SELECT * FROM files WHERE bucket=? AND path=?').get(bucket, path)
    if (!file) fail(404, '文件不存在')
    if (bucket === 'notes' && req.user?.id !== file.owner_id && req.user?.role !== 'admin') {
      const url=new URL(config.siteUrl).origin+'/api/files/notes/'+path
      const visible=db.prepare("SELECT 1 FROM articles WHERE status='published' AND (visibility='public' OR ?=1) AND instr(content,?)>0 LIMIT 1").get(Number(Boolean(formalMember(db,req.user))),url)
      if(!visible)fail(404,'图片尚未公开')
    }
    if (bucket === 'catalog' && !catalogFileVisible(db,file,req.user)) fail(req.user ? 403 : 401,'文件尚未公开')
    if (bucket === 'task-evidence' && (!req.user || (req.user.id !== file.owner_id && req.user.role !== 'admin'))) fail(req.user ? 403 : 401, '证明文件仅提交者和管理员可见')
    res.set('Content-Security-Policy', "default-src 'none'; sandbox")
    if (file.mime === 'application/octet-stream') res.attachment(basename(path))
    res.type(file.mime)
    res.sendFile(join(uploadDir, file.id))
  })
  app.delete('/api/storage/:bucket', async (req, res) => {
    if (!req.user) fail(401, '请先登录')
    if (!buckets.has(req.params.bucket) || !Array.isArray(req.body?.prefixes) || req.body.prefixes.length > 100) fail(400, '无效的文件列表')
    if (req.params.bucket === 'notes') fail(403,'笔记图片不能通过普通存储接口删除')
    const files = req.body.prefixes.map(path => db.prepare('SELECT * FROM files WHERE bucket=? AND path=?').get(req.params.bucket, path)).filter(Boolean)
    if (files.some(file => file.owner_id !== req.user.id && req.user.role !== 'admin')) fail(403, '只能删除自己的文件')
    if (files.some(file => db.prepare('SELECT 1 FROM task_submissions s,json_each(s.files) f WHERE f.value=? LIMIT 1').get(file.id))) fail(409, '已提交的证明文件不能删除')
    if (files.some(file => db.prepare('SELECT 1 FROM catalog_items i,json_each(i.assets) a WHERE a.value=? LIMIT 1').get(file.id))) fail(409,'已关联作品的文件不能删除')
    for (const file of files) {
      await unlink(join(uploadDir, file.id))
      db.prepare('DELETE FROM files WHERE id=?').run(file.id)
    }
    res.json(files.map(file => ({ name: file.path })))
  })
  installAdminDashboard(app,db,repository,now)
  installActivityRoutes(app,db,now)
  app.get('/api/members/:id',(req,res)=>{
    const profile=db.prepare('SELECT id,username,full_name,avatar_url,bio,role FROM profiles WHERE id=?').get(req.params.id)
    if(!profile)fail(404,'用户不存在')
    const offset=Number(req.query.offset||0)
    if(!Number.isInteger(offset)||offset<0||offset>1000000)fail(400,'无效的分页')
    const articles=db.prepare("SELECT id,title,summary,cover_url,created_at,likes_count,comments_count,views_count FROM articles WHERE author_id=? AND status='published' AND visibility='public' ORDER BY created_at DESC,id LIMIT 21 OFFSET ?").all(profile.id,offset)
    const stats=db.prepare("SELECT count(*) articles,coalesce(sum(likes_count),0) likes FROM articles WHERE author_id=? AND status='published' AND visibility='public'").get(profile.id)
    res.json({profile,articles:articles.slice(0,20),has_more:articles.length>20,stats})
  })
  app.get('/api/internal/access', (req,res) => res.json({ allowed:formalMember(db,req.user), threshold:formalThreshold(db), xp:req.user ? experience(db,req.user.id) : 0 }))
  app.use('/api', (_req, res) => res.status(404).json({ message: '接口不存在' }))
  app.use((error, _req, res, _next) => {
    if (res.headersSent) return res.end()
    const constraint = error.code?.includes('SQLITE_CONSTRAINT') || (error.errcode & 255) === 19
    const status = error.status || (constraint ? 400 : 500)
    if (status >= 500) console.error('API error:', error.message)
    res.status(status).json({ message: status >= 500 ? '服务器暂时无法处理请求' : error.message })
  })
  return app
}
