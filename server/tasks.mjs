import { randomUUID } from 'node:crypto'
import {adminAudit} from './admin-audit.mjs'
import { fail } from './repository.mjs'
import { experience, levelFor } from './community.mjs'
import { normalizeAudience, resolveAudience, assignTask, taskReminder } from './task-assignments.mjs'
import { publishDueTasks, validatePublishTime } from './task-scheduler.mjs'

const types = new Set(['publish', 'read', 'branch', 'gamejam', 'proof'])
const offices = new Set(['president', 'vice-president', null])
function text(value, max, required = false) {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) fail(400, '文本内容无效')
  return value.trim()
}
function integer(value, max) { if (!Number.isSafeInteger(value) || value < 1 || value > max) fail(400, '数量或经验值无效'); return value }

export function creditTaskReading(db, userId, articleId, seconds, time) {
  if (!seconds) return
  const tasks = db.prepare("SELECT t.id FROM tasks t JOIN task_enrollments e ON e.task_id=t.id WHERE e.user_id=? AND e.state='joined' AND t.type='read' AND t.status='active' AND (t.deadline IS NULL OR t.deadline>=?)").all(userId, time)
  for (const task of tasks) db.prepare('INSERT INTO task_reads(task_id,user_id,article_id,seconds) VALUES(?,?,?,?) ON CONFLICT(task_id,user_id,article_id) DO UPDATE SET seconds=min(180,seconds+excluded.seconds)').run(task.id, userId, articleId, seconds)
}

export function installTaskRoutes(app, db, repository, now = Date.now) {
  const admin = user => { if (user.role !== 'admin') fail(403, '需要管理员权限') }
  const getTask = (id, user) => {
    const task = db.prepare('SELECT * FROM tasks WHERE id=?').get(id)
    if (!task || (task.status === 'draft' && user.role !== 'admin')) fail(404, '任务不存在')
    if (task.audience && user.role !== 'admin' && !db.prepare('SELECT 1 FROM task_recipients WHERE task_id=? AND user_id=?').get(id, user.id)) fail(404, '任务不存在')
    return task
  }
  const enrollment = (id, userId) => db.prepare('SELECT * FROM task_enrollments WHERE task_id=? AND user_id=?').get(id, userId)
  const open = task => { if (task.status !== 'active' || (task.deadline !== null && task.deadline < now())) fail(409, '任务未开放或已截止') }
  function progress(task, user, entry) {
    if (!entry) return 0
    if (entry.state === 'completed') return task.target
    if (task.type === 'read') return db.prepare('SELECT article_id FROM task_reads WHERE task_id=? AND user_id=? AND seconds>=180').all(task.id, user.id).filter(row => repository.visibleArticle(row.article_id, user)).length
    if (task.type === 'publish') return db.prepare("SELECT a.id FROM task_activity v JOIN articles a ON a.id=v.entity_id WHERE v.user_id=? AND v.id>? AND v.kind='publish' AND a.author_id=? AND a.status='published'").all(user.id, entry.activity_baseline, user.id).length
    if (task.type === 'branch') return db.prepare("SELECT count(*) n FROM task_activity v WHERE v.user_id=? AND v.id>? AND ((v.kind='branch' AND EXISTS(SELECT 1 FROM knowledge_branches b WHERE b.id=v.entity_id)) OR (v.kind='branch-request' AND EXISTS(SELECT 1 FROM knowledge_branch_requests r WHERE r.id=v.entity_id AND r.status='approved')))").get(user.id, entry.activity_baseline).n
    return entry.state === 'completed' ? 1 : 0
  }
  function award(task, userId, actor) {
    db.prepare('INSERT INTO experience_ledger(id,task_id,user_id,amount,created_at,created_by,reason) VALUES(?,?,?,?,?,?,?) ON CONFLICT DO NOTHING').run(randomUUID(), task.id, userId, task.reward, now(), actor, '完成任务：' + task.title)
    db.prepare("UPDATE task_enrollments SET state='completed',completed_at=? WHERE task_id=? AND user_id=?").run(now(), task.id, userId)
  }
  function validFiles(input, userId) {
    if (!Array.isArray(input) || input.length > 5 || input.some(id => typeof id !== 'string' || id.length > 100)) fail(400, '证明文件无效')
    const ids = [...new Set(input)]
    return ids.map(id => {
      const row = db.prepare("SELECT id,path,mime,size FROM files WHERE id=? AND owner_id=? AND bucket='task-evidence'").get(id, userId)
      if (!row) fail(400, '证明文件不存在或不属于提交者')
      return row
    })
  }
  function validateEvidence(task, body, userId) {
    const note = text(body.note, 4000, true), url = text(body.url || '', 2000)
    if (url) { let parsed; try { parsed = new URL(url) } catch { fail(400, '网址无效') }; if (parsed.protocol !== 'https:' || parsed.username || parsed.password) fail(400, '请使用不带密码的 HTTPS 网址') }
    const files = validFiles(body.files || [], userId), requirements = JSON.parse(task.requirements)
    if (requirements.url && !url) fail(400, '此任务需要参赛或作品网址')
    if (requirements.image && !files.some(f => f.mime.startsWith('image/'))) fail(400, '此任务需要证明图片')
    if (requirements.build && !files.some(f => f.mime === 'application/octet-stream')) fail(400, '此任务需要作品文件')
    return { note, url, files: files.map(f => f.id) }
  }
  function presentSubmission(row) {
    return { ...row, files: JSON.parse(row.files).map(id => {
      const file = db.prepare('SELECT id,path,mime,size FROM files WHERE id=?').get(id)
      return file ? { ...file, url: '/api/files/task-evidence/' + file.path.split('/').map(encodeURIComponent).join('/') } : { id, missing: true }
    }) }
  }
  app.use('/api/tasks', (req, _res, next) => req.user ? next() : next(Object.assign(new Error('请先登录'), { status: 401 })))
  app.locals.publishDueTasks=()=>publishDueTasks(repository,now())
  app.use('/api/tasks',(_req,_res,next)=>{try{app.locals.publishDueTasks();next()}catch(error){next(error)}})
  app.get('/api/tasks/reminder', (req, res) => res.json(taskReminder(db, req.user.id, now())))
  app.post('/api/tasks/audience/preview', (req, res) => {
    admin(req.user)
    const audience = normalizeAudience(db, req.body?.audience)
    if (!audience) fail(400, '请选择派发范围')
    res.json({ count: resolveAudience(db, audience).length })
  })
  app.get('/api/tasks/me', (req, res) => {
    const xp = experience(db, req.user.id)
    const levels = db.prepare('SELECT * FROM experience_levels ORDER BY threshold').all()
    res.json({ id: req.user.id, role: req.user.role, xp, level: levels.filter(l => l.threshold <= xp).at(-1), next_level: levels.find(l => l.threshold > xp) || null, identity: db.prepare('SELECT * FROM member_identity WHERE user_id=?').get(req.user.id) || {}, disciplines: db.prepare('SELECT * FROM disciplines ORDER BY rowid').all(), levels, ledger: db.prepare('SELECT id,amount,reason,created_at FROM experience_ledger WHERE user_id=? AND amount>0 UNION ALL SELECT id,amount,reason,created_at FROM community_experience WHERE user_id=? ORDER BY created_at DESC,id LIMIT 50').all(req.user.id, req.user.id) })
  })
  app.put('/api/tasks/identity', (req, res) => {
    const id = req.body?.discipline_id
    if (id !== null && (typeof id !== 'string' || !db.prepare('SELECT 1 FROM disciplines WHERE id=?').get(id))) fail(400, '专业分支无效')
    db.prepare('INSERT INTO member_identity(user_id,discipline_id) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET discipline_id=excluded.discipline_id').run(req.user.id, id)
    res.json({ ok: true })
  })
  app.get('/api/tasks', (req, res) => {
    const offset = Number(req.query.offset || 0)
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) fail(400, '页码无效')
    const scope = req.query.scope || 'all'
    if (!['all','mine','completed'].includes(scope)) fail(400, '任务筛选无效')
    const clauses = req.user.role === 'admin' ? ['1=1'] : ["status<>'draft'"]
    const args = []
    if (req.user.role !== 'admin') { clauses.push('(audience IS NULL OR EXISTS(SELECT 1 FROM task_recipients r WHERE r.task_id=tasks.id AND r.user_id=?))'); args.push(req.user.id) }
    if (scope !== 'all') { clauses.push(`EXISTS(SELECT 1 FROM task_enrollments e WHERE e.task_id=tasks.id AND e.user_id=?${scope === 'completed' ? " AND e.state='completed'" : ''})`); args.push(req.user.id) }
    const rows = db.prepare(`SELECT * FROM tasks WHERE ${clauses.join(' AND ')} ORDER BY created_at DESC,id LIMIT 31 OFFSET ?`).all(...args,offset)
    res.json({ has_more: rows.length > 30, items: rows.slice(0, 30).map(task => {
      const entry = enrollment(task.id, req.user.id)
      const last = db.prepare('SELECT * FROM task_submissions WHERE task_id=? AND user_id=? ORDER BY submitted_at DESC,rowid DESC LIMIT 1').get(task.id, req.user.id)
      const { audience, ...safeTask } = task
      return { ...safeTask, assigned: Boolean(audience), ...(req.user.role === 'admin' ? { audience: audience ? JSON.parse(audience) : null, recipient_count: db.prepare('SELECT count(*) n FROM task_recipients WHERE task_id=?').get(task.id).n } : {}), requirements: JSON.parse(task.requirements), enrollment: entry || null, progress: Math.min(task.target, progress(task, req.user, entry)), submission: last ? presentSubmission(last) : null }
    }) })
  })
  app.post('/api/tasks', (req, res) => {
    admin(req.user)
    const body = req.body || {}, title = text(body.title, 120, true), description = text(body.description || '', 6000)
    if (!types.has(body.type)) fail(400, '任务模板无效')
    const target = ['gamejam', 'proof'].includes(body.type) ? 1 : integer(body.target, 1000), reward = integer(body.reward, 10000)
    const deadline = body.deadline ?? null
    const audience = normalizeAudience(db, body.audience)
    if (audience && deadline === null) fail(400, '派发任务必须设置截止时间')
    if (deadline !== null && (!Number.isSafeInteger(deadline) || deadline <= now() || !Number.isFinite(new Date(deadline).getTime()))) fail(400, '截止时间无效')
    const publishAt=validatePublishTime(body.publish_at??null,deadline,now())
    const requirements = {}
    for (const key of ['url', 'image', 'build']) { if (body.requirements?.[key] !== undefined && typeof body.requirements[key] !== 'boolean') fail(400, '证明要求无效'); requirements[key] = Boolean(body.requirements?.[key]) }
    if (body.type === 'gamejam') requirements.url = true
    if (body.is_advanced !== undefined && typeof body.is_advanced !== 'boolean') fail(400, '进阶任务标记无效')
    if (body.is_advanced && reward !== 100) fail(400, '进阶任务固定奖励 100 EXP')
    const id = randomUUID()
    repository.transaction(()=>{
    db.prepare("INSERT INTO tasks(id,title,description,type,target,reward,status,deadline,requirements,created_by,created_at) VALUES(?,?,?,?,?,?,'draft',?,?,?,?)").run(id, title, description, body.type, target, reward, deadline, JSON.stringify(requirements), req.user.id, now())
    db.prepare('UPDATE tasks SET is_advanced=? WHERE id=?').run(body.is_advanced ? 1 : 0, id)
    db.prepare('UPDATE tasks SET audience=? WHERE id=?').run(audience ? JSON.stringify(audience) : null, id)
    if(publishAt!==null){db.prepare('UPDATE tasks SET publish_at=?,scheduled_by=? WHERE id=?').run(publishAt,req.user.id,id);adminAudit(db,req.user,'安排任务定时发布','task',id,String(publishAt),now())}
    adminAudit(db,req.user,'创建任务','task',id,title,now())
    })
    res.status(201).json({ id,publish_at:publishAt })
  })
  app.patch('/api/tasks/:id/schedule',(req,res)=>{
    admin(req.user)
    repository.transaction(()=>{
      const task=getTask(req.params.id,req.user),body=req.body||{}
      if(task.status!=='draft')fail(409,'只有未发布的草稿可以安排定时发布')
      if(!Object.hasOwn(body,'expected_publish_at')||body.expected_publish_at!==task.publish_at)fail(409,'定时设置已变化，请刷新任务后重试')
      if(!Object.hasOwn(body,'publish_at')||Object.keys(body).some(k=>!['publish_at','expected_publish_at'].includes(k)))fail(400,'无效的定时设置')
      const publishAt=validatePublishTime(body.publish_at,task.deadline,now())
      db.prepare("UPDATE tasks SET publish_at=?,scheduled_by=?,schedule_error='' WHERE id=?").run(publishAt,publishAt===null?null:req.user.id,task.id)
      adminAudit(db,req.user,publishAt===null?'取消任务定时发布':'安排任务定时发布','task',task.id,String(publishAt??''),now())
    })
    res.json({ok:true})
  })
  app.patch('/api/tasks/:id/status', (req, res) => {
    admin(req.user); const task = getTask(req.params.id, req.user), status = req.body?.status
    if (!['active', 'closed'].includes(status) || (status === 'active' && task.deadline !== null && task.deadline < now())) fail(400, '任务状态无效或已过期')
    repository.transaction(()=>{if (status === 'active') assignTask(db,task,now());db.prepare("UPDATE tasks SET status=?,publish_at=NULL,scheduled_by=NULL,schedule_error='' WHERE id=?").run(status, task.id);adminAudit(db,req.user,'调整任务状态','task',task.id,status,now())}); res.json({ ok: true })
  })
  app.post('/api/tasks/:id/join', (req, res) => {
    repository.transaction(() => {
      const task = getTask(req.params.id, req.user); open(task)
      if (task.is_advanced && experience(db, req.user.id) < 50) fail(403, '达到 50 EXP 后才能领取进阶任务')
      db.prepare('INSERT INTO task_enrollments(task_id,user_id,joined_at,activity_baseline) VALUES(?,?,?,?) ON CONFLICT DO NOTHING').run(task.id, req.user.id, now(), db.prepare('SELECT coalesce(max(id),0) n FROM task_activity').get().n)
    }); res.json({ ok: true })
  })
  app.post('/api/tasks/:id/claim', (req, res) => {
    repository.transaction(() => {
      const task = getTask(req.params.id, req.user), entry = enrollment(task.id, req.user.id)
      if (entry?.state === 'completed') return
      open(task)
      if (!entry || entry.state !== 'joined' || !['publish', 'read', 'branch'].includes(task.type) || progress(task, req.user, entry) < task.target) fail(409, '任务尚未完成')
      award(task, req.user.id, req.user.id)
    }); res.json({ ok: true })
  })
  app.post('/api/tasks/:id/submit', (req, res) => {
    repository.transaction(() => {
      const task = getTask(req.params.id, req.user); open(task)
      const entry = enrollment(task.id, req.user.id)
      if (!entry || !['joined', 'rejected'].includes(entry.state) || !['gamejam', 'proof'].includes(task.type)) fail(409, '此任务不能提交证明')
      const proof = validateEvidence(task, req.body || {}, req.user.id)
      db.prepare('INSERT INTO task_submissions(id,task_id,user_id,note,url,files,submitted_at) VALUES(?,?,?,?,?,?,?)').run(randomUUID(), task.id, req.user.id, proof.note, proof.url, JSON.stringify(proof.files), now())
      db.prepare("UPDATE task_enrollments SET state='submitted' WHERE task_id=? AND user_id=?").run(task.id, req.user.id)
    }); res.status(201).json({ ok: true })
  })
  app.get('/api/tasks/reviews', (req, res) => {
    admin(req.user)
    const offset = Number(req.query.offset || 0)
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) fail(400, '页码无效')
    const rows = db.prepare("SELECT s.*,t.title,p.username FROM task_submissions s JOIN tasks t ON t.id=s.task_id JOIN profiles p ON p.id=s.user_id ORDER BY CASE s.status WHEN 'pending' THEN 0 ELSE 1 END,s.submitted_at DESC,s.rowid DESC LIMIT 31 OFFSET ?").all(offset)
    res.json({ items: rows.slice(0,30).map(presentSubmission), has_more: rows.length>30, rewards: db.prepare('SELECT l.*,t.title,p.username,EXISTS(SELECT 1 FROM experience_ledger r WHERE r.reverses_id=l.id) reversed FROM experience_ledger l JOIN tasks t ON t.id=l.task_id JOIN profiles p ON p.id=l.user_id WHERE l.amount>0 ORDER BY l.created_at DESC,l.rowid DESC LIMIT 50').all() })
  })
  app.post('/api/tasks/reviews/:id', (req, res) => {
    admin(req.user)
    repository.transaction(() => {
      const row = db.prepare('SELECT * FROM task_submissions WHERE id=?').get(req.params.id)
      if (!row || row.status !== 'pending') fail(409, '审核已处理或不存在')
      if (row.user_id === req.user.id) fail(403, '不能审核自己的任务证明')
      const approved = req.body?.approved
      if (typeof approved !== 'boolean') fail(400, '审核结果无效')
      const note = text(req.body?.note || '', 1000, !approved), task = getTask(row.task_id, req.user)
      if (approved) validateEvidence(task, { ...row, files: JSON.parse(row.files) }, row.user_id)
      db.prepare('UPDATE task_submissions SET status=?,review_note=?,reviewed_by=?,reviewed_at=? WHERE id=?').run(approved ? 'approved' : 'rejected', note, req.user.id, now(), row.id)
      adminAudit(db,req.user,'任务证明审核','proof',row.id,approved?'通过':note,now())
      if (approved) award(task, row.user_id, req.user.id)
      else db.prepare("UPDATE task_enrollments SET state='rejected' WHERE task_id=? AND user_id=?").run(task.id, row.user_id)
    }); res.json({ ok: true })
  })
  app.post('/api/tasks/rewards/:id/reverse', (req, res) => {
    admin(req.user)
    fail(409, '经验只会累加，不支持撤销或扣除')
  })
  app.get('/api/tasks/people', (req, res) => {
    admin(req.user); const q = text(req.query.q || '', 100)
    res.json(db.prepare("SELECT p.id,p.username,i.office,i.discipline_id FROM profiles p LEFT JOIN member_identity i ON i.user_id=p.id WHERE instr(lower(p.username),lower(?))>0 ORDER BY p.username LIMIT 50").all(q).map(person => { const xp=experience(db,person.id); return {...person,xp,level:levelFor(db,xp).level} }))
  })
  app.put('/api/tasks/people/:id', (req, res) => {
    admin(req.user); const office = req.body?.office
    if (!offices.has(office) || !db.prepare('SELECT 1 FROM profiles WHERE id=?').get(req.params.id)) fail(400, '职位或社员无效')
    repository.transaction(()=>{db.prepare('INSERT INTO member_identity(user_id,office) VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET office=excluded.office').run(req.params.id, office);adminAudit(db,req.user,'调整职位','member',req.params.id,office,now())})
    res.json({ ok: true })
  })
  app.put('/api/tasks/levels', (req, res) => {
    admin(req.user); const levels = req.body?.levels
    if (!Array.isArray(levels) || levels.length !== 4 || levels[0]?.threshold !== 0 || levels.some((l,i) => !Number.isSafeInteger(l.threshold) || l.threshold < 0 || l.threshold>100000000 || (i>0 && l.threshold<=levels[i-1].threshold))) fail(400, '等级门槛必须从 0 开始严格递增')
    repository.transaction(() => { db.exec('DELETE FROM experience_levels'); for (const l of levels) db.prepare('INSERT INTO experience_levels(threshold,title) VALUES(?,?)').run(l.threshold, text(l.title,30,true));adminAudit(db,req.user,'调整经验等级','levels','',JSON.stringify(levels),now()) })
    res.json({ ok: true })
  })
}
