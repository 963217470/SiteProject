import { randomUUID } from 'node:crypto'
import { fail } from './repository.mjs'
import { experience } from './experience.mjs'

export function normalizeAudience(db, input) {
  if (input == null) return null
  if (typeof input !== 'object' || Array.isArray(input)) fail(400, '派发范围无效')
  if (input.kind === 'users') {
    if (!Array.isArray(input.ids) || !input.ids.length || input.ids.length > 200 || input.ids.some(id => typeof id !== 'string' || !id || id.length > 100)) fail(400, '请选择 1 至 200 位成员')
    const ids = [...new Set(input.ids)]
    if (ids.some(id => !db.prepare('SELECT 1 FROM profiles WHERE id=?').get(id))) fail(400, '接收成员不存在')
    return { kind: 'users', ids }
  }
  const lookups = {
    level: () => db.prepare('SELECT 1 FROM experience_levels WHERE threshold=?').get(Number(input.value)),
    discipline: () => db.prepare('SELECT 1 FROM disciplines WHERE id=?').get(input.value),
    office: () => ['president', 'vice-president'].includes(input.value),
    role: () => ['user', 'member', 'admin'].includes(input.value),
    all: () => true
  }
  if (!Object.hasOwn(lookups, input.kind) || (input.kind !== 'all' && (typeof input.value !== 'string' || input.value.length > 100)) || !lookups[input.kind]()) fail(400, '成员身份无效')
  return input.kind === 'all' ? { kind: 'all' } : { kind: input.kind, value: input.value }
}

export function resolveAudience(db, audience) {
  if (audience.kind === 'users') return audience.ids
  const rows = db.prepare('SELECT p.id,p.role,i.office,i.discipline_id FROM profiles p LEFT JOIN member_identity i ON i.user_id=p.id LIMIT 5001').all()
  if (rows.length > 5000) fail(409, '成员数量过多，请分批派发')
  const levels = db.prepare('SELECT threshold FROM experience_levels ORDER BY threshold').all()
  return rows.filter(row => {
    if (audience.kind === 'all') return true
    if (audience.kind === 'level') return levels.filter(level => level.threshold <= experience(db, row.id)).at(-1)?.threshold === Number(audience.value)
    return row[{ discipline: 'discipline_id', office: 'office', role: 'role' }[audience.kind]] === audience.value
  }).map(row => row.id)
}

export function assignTask(db, task, now) {
  if (!task.audience || db.prepare('SELECT 1 FROM task_recipients WHERE task_id=? LIMIT 1').get(task.id)) return
  const recipients = resolveAudience(db, normalizeAudience(db, JSON.parse(task.audience)))
  if (!recipients.length) fail(409, '没有符合条件的接收成员，尚未发布')
  if (task.is_advanced && recipients.some(id => experience(db, id) < 50)) fail(409, '接收名单中有未达到 50 EXP 的成员，无法派发进阶任务')
  const baseline = db.prepare('SELECT coalesce(max(id),0) n FROM task_activity').get().n
  for (const id of recipients) {
    db.prepare('INSERT INTO task_recipients VALUES(?,?,?)').run(task.id, id, now)
    db.prepare('INSERT INTO task_enrollments(task_id,user_id,joined_at,activity_baseline) VALUES(?,?,?,?) ON CONFLICT DO NOTHING').run(task.id, id, now, baseline)
    db.prepare('INSERT OR IGNORE INTO notifications(id,user_id,event_key,title,body,href,created_at,category) VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(), id, 'assigned-task:' + task.id, '收到新任务：' + task.title, '管理员向你派发了任务，请在截止前完成并提交。', '/tasks/?scope=mine', now, 'result')
  }
}

export function taskReminder(db, userId, now) {
  const sql = "FROM task_recipients r JOIN tasks t ON t.id=r.task_id JOIN task_enrollments e ON e.task_id=r.task_id AND e.user_id=r.user_id WHERE r.user_id=? AND t.status='active' AND e.state IN ('joined','submitted','rejected') AND t.deadline IS NOT NULL"
  return { server_now: now, count: db.prepare('SELECT count(*) n ' + sql).get(userId).n, nearest: db.prepare('SELECT t.id,t.title,t.deadline,e.state ' + sql + ' ORDER BY t.deadline,t.id LIMIT 1').get(userId) || null }
}
