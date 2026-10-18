import { randomUUID } from 'node:crypto'
import { fail } from './repository.mjs'
import { assignTask } from './task-assignments.mjs'
import { adminAudit } from './admin-audit.mjs'

export function validatePublishTime(value,deadline,now) {
  if(value===null)return null
  if(!Number.isSafeInteger(value)||value<=now||!Number.isFinite(new Date(value).getTime()))fail(400,'发布时间必须是有效的未来时间')
  if(deadline!==null&&value>=deadline)fail(400,'发布时间必须早于截止时间')
  return value
}

export function publishDueTasks(repository,now) {
  const db=repository.db,result={published:0,failed:0,errors:0}
  const due=db.prepare("SELECT id,publish_at FROM tasks WHERE status='draft' AND publish_at<=? ORDER BY publish_at,id LIMIT 5").all(now)
  for(const candidate of due) {
    try {
      const published=repository.transaction(()=>{
        const task=db.prepare("SELECT * FROM tasks WHERE id=? AND status='draft' AND publish_at=?").get(candidate.id,candidate.publish_at)
        if(!task)return false
        const actor=db.prepare('SELECT id,username,role FROM profiles WHERE id=?').get(task.scheduled_by)
        if(actor?.role!=='admin')fail(409,'安排发布的账号已无管理员权限，请由管理员重新安排')
        if(task.deadline!==null&&task.deadline<=now)fail(409,'任务截止时间已过，未自动发布')
        assignTask(db,task,now)
        db.prepare("UPDATE tasks SET status='active',publish_at=NULL,schedule_error='' WHERE id=?").run(task.id)
        adminAudit(db,actor,'定时发布任务','task',task.id,JSON.stringify({publish_at:candidate.publish_at,published_at:now}),now)
        return true
      })
      if(published)result.published++
    }catch(error){
      if(!error.status||error.status>=500){result.errors++;continue}
      repository.transaction(()=>{
        const changed=db.prepare("UPDATE tasks SET publish_at=NULL,schedule_error=? WHERE id=? AND status='draft' AND publish_at=?").run(error.message.slice(0,1000),candidate.id,candidate.publish_at)
        if(!changed.changes)return
        result.failed++
        for(const person of db.prepare("SELECT id FROM profiles WHERE role='admin'").all())db.prepare('INSERT OR IGNORE INTO notifications(id,user_id,event_key,title,body,href,created_at,category) VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),person.id,'task-schedule-failed:'+candidate.id+':'+candidate.publish_at,'定时任务未能发布',error.message,'/admin/tasks',now,'result')
      })
    }
  }
  return result
}

export function startTaskScheduler(run,intervalMs=15000) {
  const tick=()=>{try{const result=run();if(result?.errors)console.error('Task scheduler: deferred processing error')}catch{console.error('Task scheduler: processing failed')}}
  tick()
  const timer=setInterval(tick,intervalMs);timer.unref()
  return ()=>clearInterval(timer)
}
