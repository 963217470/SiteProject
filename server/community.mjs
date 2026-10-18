import { randomUUID } from 'node:crypto'
import { fail } from './repository.mjs'
import { experience } from './experience.mjs'
export { experience } from './experience.mjs'

const DAY = 86400000, OFFSET = 28800000
export const communityDay = time => new Date(time + OFFSET).toISOString().slice(0, 10)
export const nextReset = time => Math.floor((time + OFFSET) / DAY) * DAY + DAY - OFFSET
export function levelFor(db, xp) {
  const levels = db.prepare('SELECT * FROM experience_levels ORDER BY threshold').all()
  const level = levels.filter(l => l.threshold <= xp).at(-1)
  return { level, next_level: levels.find(l => l.threshold > xp) || null, levels }
}
function notify(db, user, key, title, body, href, time,category='result') {
  db.prepare('INSERT OR IGNORE INTO notifications(id,user_id,event_key,title,body,href,created_at,category) VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(), user, key, title, body, href, time,category)
}
export function dailyAward(db, user, kind, amount, reason, time) {
  db.prepare('INSERT OR IGNORE INTO community_experience VALUES(?,?,?,?,?,?)').run(randomUUID(), user, communityDay(time) + ':' + kind, amount, reason, time)
}
export function creditDailyReading(db, user, article, seconds, time) {
  if (!seconds || db.prepare('SELECT status FROM articles WHERE id=?').get(article)?.status !== 'published') return
  // Split a validated foreground interval at Beijing midnight; never carry yesterday's progress over.
  const start = time - seconds * 1000, boundary = nextReset(start)
  const portions = boundary <= time ? [[start, Math.floor((boundary - start) / 1000)], [time, Math.floor((time - boundary) / 1000)]] : [[time, seconds]]
  for (const [at, credit] of portions) {
    if (!credit) continue
    const day = communityDay(at)
    db.prepare('INSERT INTO daily_reads VALUES(?,?,?,?) ON CONFLICT(user_id,day,article_id) DO UPDATE SET seconds=min(150,seconds+excluded.seconds)').run(user, day, article, credit)
    if (db.prepare('SELECT seconds FROM daily_reads WHERE user_id=? AND day=? AND article_id=?').get(user, day, article).seconds >= 150) dailyAward(db, user, 'read', 5, '每日阅读 150 秒', at)
  }
}
export function flushCommunity(db, now = Date.now) {
  const labels = { article: '文章', comment: '评论', catalog: '游戏/工具作品', profile: '资料修改', branch: '知识库申请', proof: '任务证明' }
  const adminLinks = { article: '/admin/articles', comment: '/admin/comments/', catalog: '/games-tools/?scope=review', profile: '/admin/profile-review', branch: '/admin/kb', proof: '/admin/tasks?view=reviews' }
  for (const event of db.prepare('SELECT * FROM community_events ORDER BY created_at,rowid').all()) {
    const label = labels[event.kind], time = event.created_at
    let href = '/messages/'
    if (event.kind === 'article') href = '/article?id=' + encodeURIComponent(event.entity_id)
    if (event.kind === 'comment') {
      const row = db.prepare('SELECT article_id FROM comments WHERE id=?').get(event.entity_id)
      if (row) href = '/article?id=' + encodeURIComponent(row.article_id) + '#comments'
    }
    if (event.kind === 'catalog') href = '/games-tools/?id=' + encodeURIComponent(event.entity_id)
    if (event.kind === 'proof') href = '/tasks/'
    if (event.kind === 'profile') href = '/user/profile?tab=settings'
    if (event.kind === 'branch') href = '/user/profile?tab=articles'
    if (event.new_status === 'pending') {
      for (const admin of db.prepare("SELECT id FROM profiles WHERE role='admin'").all()) notify(db, admin.id, event.id, '新的' + label + '待审核', '收到一份' + label + '提交申请。', adminLinks[event.kind], time,'review')
    }
    if (['approved', 'published', 'rejected'].includes(event.new_status)) {
      const approved = event.new_status !== 'rejected'
      notify(db, event.user_id, event.id, label + (approved ? '审核通过' : '未通过审核'), approved ? '你的' + label + '已通过审核。' : '请查看审核说明后修改并重新提交。', href, time)
      if(approved&&event.kind==='comment'){
        const comment=db.prepare("SELECT c.user_id,c.parent_id,p.user_id parent_user,a.author_id FROM comments c LEFT JOIN comments p ON p.id=c.parent_id JOIN articles a ON a.id=c.article_id WHERE c.id=? AND a.status='published'").get(event.entity_id)
        if(comment){
          const targets=new Map([[comment.author_id,'你的文章收到新评论']])
          if(comment.parent_user)targets.set(comment.parent_user,'你的评论收到回复')
          for(const [recipient,title] of targets)if(recipient!==comment.user_id)notify(db,recipient,'interaction:'+event.entity_id,title,'新评论已通过审核，点击查看。',href,time,'interaction')
        }
      }
      if (approved && ['article', 'comment'].includes(event.kind)) {
        const inserted = db.prepare('INSERT OR IGNORE INTO rewarded_content VALUES(?,?)').run(event.kind, event.entity_id).changes
        if (inserted) dailyAward(db, event.user_id, event.kind, event.kind === 'article' ? 10 : 5, '每日' + label + '发布', time)
      }
    }
    if ((event.old_status === 'published' && event.new_status !== 'published') || event.new_status === 'archived' || (event.old_status === 'approved' && event.new_status === 'rejected')) {
      notify(db, event.user_id, event.id + ':withdrawn', label + '已撤回或下架', '该内容已不再公开展示，已获得的经验不会扣除。', href, time)
    }
    db.prepare('DELETE FROM community_events WHERE id=?').run(event.id)
  }
  for (const user of db.prepare('SELECT id FROM profiles').all()) {
    const level = levelFor(db, experience(db, user.id)).level
    const previous = db.prepare('SELECT threshold FROM community_levels WHERE user_id=?').get(user.id)?.threshold ?? 0
    if (level.threshold > previous) notify(db, user.id, 'level:' + level.threshold, '升级为' + level.title, '恭喜，你的累计经验已达到 ' + experience(db, user.id) + ' EXP。', '/tasks/', now(),'level')
    db.prepare('INSERT INTO community_levels VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET threshold=max(threshold,excluded.threshold)').run(user.id, level.threshold)
  }
}

export function installCommunityRoutes(app, db, repository, now = Date.now) {
  const auth = (req, _res, next) => req.user ? next() : next(Object.assign(new Error('请先登录'), { status: 401 }))
  app.use('/api/community', auth)
  app.use('/api/messages', auth)
  app.get('/api/community/daily', (req, res) => {
    const time = now(), day = communityDay(time), user = req.user.id
    const checkin = db.prepare('SELECT * FROM checkins WHERE user_id=? AND day=?').get(user, day)
    const yesterday = db.prepare('SELECT streak FROM checkins WHERE user_id=? AND day=?').get(user, communityDay(time - DAY))
    const earned = db.prepare('SELECT source_key,amount FROM community_experience WHERE user_id=? AND source_key LIKE ?').all(user, day + ':%')
    res.json({ day, server_time:time, reset_at: nextReset(time), checked_in: !!checkin, streak: checkin?.streak || yesterday?.streak || 0, xp: experience(db, user), advanced_unlocked: experience(db, user) >= 50, tasks: [
      ['checkin', '签到', 5], ['streak', '连续签到 7 天额外奖励', 5], ['read', '浏览一篇文章 150 秒', 5], ['comment', '评论审核通过', 5], ['article', '发表一篇文章', 10]
    ].map(([kind, title, reward]) => ({ kind, title, reward, done: earned.some(row => row.source_key === day + ':' + kind) })), reading_seconds: db.prepare('SELECT coalesce(max(seconds),0) seconds FROM daily_reads WHERE user_id=? AND day=?').get(user, day).seconds })
  })
  app.post('/api/community/checkin', (req, res) => {
    const time=now()
    const result = repository.transaction(() => {
      const day = communityDay(time), user = req.user.id
      const existing = db.prepare('SELECT streak FROM checkins WHERE user_id=? AND day=?').get(user, day)
      if (existing) return { streak: existing.streak, reward: 0, currency_reward: 0, already: true }
      const previous = db.prepare('SELECT streak FROM checkins WHERE user_id=? AND day=?').get(user, communityDay(time - DAY))
      const streak = (previous?.streak || 0) + 1
      db.prepare('INSERT INTO checkins VALUES(?,?,?)').run(user, day, streak)
      dailyAward(db, user, 'checkin', 5, '每日签到', time)
      if (streak % 7 === 0) dailyAward(db, user, 'streak', 5, '连续签到 7 天', time)
      return { streak, reward: streak % 7 === 0 ? 10 : 5, currency_reward: 0, already: false }
    })
    res.json({...result,day:communityDay(time),server_time:time,reset_at:nextReset(time)})
  })
  app.get('/api/messages', (req, res) => {
    const offset = Number(req.query.offset || 0)
    if (!Number.isSafeInteger(offset) || offset < 0 || offset > 100000) fail(400, '页码无效')
    const category=req.query.category||'',state=req.query.state||'all'
    if(category&&!['review','result','interaction','level','announcement'].includes(category)||!['all','unread','archived'].includes(state))fail(400,'消息筛选无效')
    const where="user_id=? AND ((?='archived' AND archived_at IS NOT NULL) OR (?<>'archived' AND archived_at IS NULL)) AND (?='' OR category=?) AND (?<>'unread' OR read_at IS NULL)"
    const args=[req.user.id,state,state,category,category,state]
    const rows = db.prepare('SELECT * FROM notifications WHERE '+where+' ORDER BY created_at DESC,rowid DESC LIMIT 31 OFFSET ?').all(...args,offset)
    res.json({ items: rows.slice(0, 30), has_more: rows.length > 30,total:db.prepare('SELECT count(*) n FROM notifications WHERE '+where).get(...args).n,unread: db.prepare('SELECT count(*) n FROM notifications WHERE user_id=? AND read_at IS NULL AND archived_at IS NULL').get(req.user.id).n,sync_at:now(),sync_cursor:db.prepare('SELECT coalesce(max(rowid),0) n FROM notifications WHERE user_id=?').get(req.user.id).n })
  })
  app.get('/api/messages/unread',(req,res)=>res.json({unread:db.prepare('SELECT count(*) n FROM notifications WHERE user_id=? AND read_at IS NULL AND archived_at IS NULL').get(req.user.id).n}))
  app.post('/api/messages/read', (req, res) => {
    const id=req.body?.id,before=req.body?.before??now(),cursor=req.body?.cursor
    if (id !== undefined && (typeof id !== 'string'||!id.trim()||id.length>100)||!Number.isSafeInteger(before)||before<0||before>now()||cursor!==undefined&&(!Number.isSafeInteger(cursor)||cursor<0)) fail(400, '消息无效')
    db.prepare('UPDATE notifications SET read_at=? WHERE user_id=? AND read_at IS NULL AND archived_at IS NULL AND created_at<=?' + (id ? ' AND id=?' : '')+(cursor!==undefined?' AND rowid<=?':'')).run(now(), req.user.id,before,...(id ? [id] : []),...(cursor!==undefined?[cursor]:[]))
    res.json({ ok: true })
  })
  app.post('/api/messages/:id/archive',(req,res)=>{
    if(!req.params.id||req.params.id.length>100)fail(400,'消息无效')
    const result=db.prepare('UPDATE notifications SET archived_at=? WHERE id=? AND user_id=? AND archived_at IS NULL').run(now(),req.params.id,req.user.id)
    if(!result.changes)fail(404,'消息不存在或已归档')
    res.json({ok:true})
  })
  app.post('/api/messages/:id/restore',(req,res)=>{
    const result=db.prepare('UPDATE notifications SET archived_at=NULL WHERE id=? AND user_id=? AND archived_at IS NOT NULL').run(req.params.id,req.user.id)
    if(!result.changes)fail(404,'消息不存在或未归档')
    res.json({ok:true})
  })
}
