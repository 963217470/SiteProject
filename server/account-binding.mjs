import { randomUUID } from 'node:crypto'
import { fail } from './repository.mjs'

const lifetime = 10 * 60 * 1000
export function bindingFlow(db, session, user, now) {
  const flow = session.githubBinding
  if (!user || !flow || flow.owner !== user.id || flow.expires <= now) fail(409, '改绑已过期，请重新验证原账号')
  const account = db.prepare('SELECT * FROM users WHERE id=?').get(user.id)
  if (!account || account.github_id !== flow.original) fail(409, '账号绑定已发生变化，请重新开始')
  return { flow, account }
}

export function acceptBindingIdentity(db, session, user, profile, now, adminIds = []) {
  const { flow } = bindingFlow(db, session, user, now)
  if (flow.stage === 'verify-original') {
    if (profile.id !== flow.original) fail(403, '请选择当前绑定的 GitHub 账号完成验证')
    flow.stage = 'choose-new'
  } else if (flow.stage === 'verify-new') {
    if (!profile.id || profile.id === flow.original) fail(409, '请选择另一个 GitHub 账号')
    if (adminIds.includes(profile.id)) fail(403, '该 GitHub 账号由服务器管理员配置管理，不能用于改绑')
    if (db.prepare('SELECT id FROM users WHERE github_id=?').get(profile.id)) fail(409, '该 GitHub 账号已绑定其他网站账号，不能合并或覆盖')
    flow.target = { id: profile.id, username: profile.username, email: profile.emails?.[0]?.value || null }
    flow.stage = 'confirm'
  } else fail(409, '验证步骤无效，请重新开始')
  session.githubBinding = flow
}

export function confirmBinding(db, repository, session, user, sid, now, adminIds = []) {
  return repository.transaction(() => {
    const { flow } = bindingFlow(db, session, user, now)
    if (flow.stage !== 'confirm' || !flow.target) fail(409, '请先验证新 GitHub 账号')
    if (adminIds.includes(flow.original) || adminIds.includes(flow.target.id)) fail(403, '服务器配置指定的管理员账号需由运维改绑')
    if (db.prepare('SELECT id FROM users WHERE github_id=?').get(flow.target.id)) fail(409, '新账号已被绑定，请重新开始')
    db.prepare('UPDATE users SET github_id=?,github_username=?,email=? WHERE id=? AND github_id=?').run(flow.target.id, flow.target.username, flow.target.email, user.id, flow.original)
    db.prepare("DELETE FROM sessions WHERE json_extract(data,'$.passport.user')=? AND sid<>?").run(user.id, sid)
    db.prepare('UPDATE mcp_tokens SET revoked_at=? WHERE user_id=? AND revoked_at IS NULL').run(now, user.id)
    db.prepare('INSERT INTO notifications(id,user_id,event_key,title,body,href,created_at,category) VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(), user.id, 'github-binding:' + randomUUID(), 'GitHub 账号改绑成功', '已绑定 ' + flow.target.username + '。其他登录会话及 MCP 上传令牌已失效，请重新授权。', '/user/profile?tab=security', now, 'result')
    delete session.githubBinding
    delete session.githubBindingOAuth
    return { ok: true }
  })
}

export function installBindingRoutes(app, db, repository, passport, config, limit, now) {
  const requireUser = (req, _res, next) => { if (!req.user) return next(Object.assign(new Error('请先登录'), { status: 401 })); next() }
  app.get('/api/account/github', requireUser, (req, res) => {
    const account = db.prepare('SELECT github_id,github_username FROM users WHERE id=?').get(req.user.id)
    let flow
    try { flow = bindingFlow(db, req.session, req.user, now()).flow } catch { /* Expired workflows are not resumable. */ }
    res.json({ username: account.github_username, available: Boolean(config.githubClientId && config.githubClientSecret), managed: config.adminGithubIds.includes(account.github_id), stage: flow?.stage || 'idle', target: flow?.stage === 'confirm' ? flow.target.username : null })
  })
  app.post('/api/account/github/start', limit, requireUser, (req, res) => {
    if (!config.githubClientId || !config.githubClientSecret) fail(503, 'GitHub 登录暂不可用')
    const account = db.prepare('SELECT github_id FROM users WHERE id=?').get(req.user.id)
    if (config.adminGithubIds.includes(account.github_id)) fail(403, '此账号由服务器管理员配置指定，请由运维同步修改绑定与管理员配置')
    if (req.body?.step === 'new') {
      const { flow } = bindingFlow(db, req.session, req.user, now())
      if (flow.stage !== 'choose-new') fail(409, '请先验证原账号')
      flow.stage = 'verify-new'
    } else req.session.githubBinding = { owner: req.user.id, original: account.github_id, expires: now() + lifetime, stage: 'verify-original' }
    req.session.githubBinding.nonce = randomUUID()
    res.json({ authorization_url: '/api/account/github/authorize?nonce=' + req.session.githubBinding.nonce })
  })
  app.get('/api/account/github/authorize', limit, requireUser, (req, res, next) => {
    const { flow } = bindingFlow(db, req.session, req.user, now())
    if (!flow.nonce || flow.nonce !== req.query.nonce) fail(403, '授权请求无效，请从个人中心重新开始')
    delete flow.nonce
    req.session.githubBindingOAuth = true
    passport.authenticate('github', { scope: ['user:email'], prompt: 'select_account' })(req, res, next)
  })
  app.post('/api/account/github/confirm', limit, requireUser, (req, res) => res.json(confirmBinding(db, repository, req.session, req.user, req.sessionID, now(), config.adminGithubIds)))
  app.delete('/api/account/github', requireUser, (req, res) => { delete req.session.githubBinding; delete req.session.githubBindingOAuth; res.json({ ok: true }) })
}
