import {randomUUID} from 'node:crypto'
export function adminAudit(db,user,action,kind,id,detail,at=Date.now()) {
  if(user?.role!=='admin')return
  db.prepare('INSERT INTO admin_activity VALUES(?,?,?,?,?,?,?,?)').run(randomUUID(),user.id,user.username||db.prepare('SELECT username FROM profiles WHERE id=?').get(user.id)?.username||'管理员',action,kind,String(id||''),String(detail||'').slice(0,1000),at)
}
