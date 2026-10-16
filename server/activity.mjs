import {fail} from './repository.mjs'
const DAY=86400000,OFFSET=28800000
const date=at=>new Date(at+OFFSET).toISOString().slice(0,10)
export function activityWeek(at){
  const day=Math.floor((at+OFFSET)/DAY)*DAY-OFFSET
  return day-((new Date(at+OFFSET).getUTCDay()+6)%7)*DAY
}
export function installActivityRoutes(app,db,now=Date.now){
  app.get('/api/activity/weekly',(req,res)=>{
    const current=activityWeek(now()),week=req.query.week
    let start=current
    if(week!==undefined){
      if(typeof week!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(week))fail(400,'周日期无效')
      start=Date.parse(week+'T00:00:00+08:00')
      if(!Number.isFinite(start)||date(start)!==week||activityWeek(start)!==start||start>current||start<0)fail(400,'请选择不晚于本周的周一日期')
    }
    const end=start+7*DAY,offset=Number(req.query.offset||0),limit=Number(req.query.limit||20)
    if(!Number.isSafeInteger(offset)||offset<0||offset>100000||!Number.isSafeInteger(limit)||limit<1||limit>50)fail(400,'分页参数无效')
    const sql=`WITH earned AS (
      SELECT user_id,amount FROM community_experience WHERE created_at>=? AND created_at<?
      UNION ALL SELECT user_id,amount FROM experience_ledger WHERE created_at>=? AND created_at<? AND amount>0
    ),totals AS (SELECT user_id,sum(amount) weekly_exp FROM earned GROUP BY user_id HAVING sum(amount)>0),
    ranked AS (SELECT p.id,p.username,p.avatar_url,t.weekly_exp,rank() OVER(ORDER BY t.weekly_exp DESC) rank FROM totals t JOIN profiles p ON p.id=t.user_id)`
    const args=[start,end,start,end]
    const rows=db.prepare(sql+' SELECT * FROM ranked ORDER BY weekly_exp DESC,username COLLATE NOCASE,id LIMIT ? OFFSET ?').all(...args,limit+1,offset)
    const own=req.user?(db.prepare(sql+' SELECT * FROM ranked WHERE id=?').get(...args,req.user.id)||{id:req.user.id,weekly_exp:0,rank:null}):null
    res.json({week_start:date(start),week_end:date(end-DAY),start_at:start,end_at:end,is_current:start===current,previous_week:start>=7*DAY?date(start-7*DAY):null,next_week:start<current?date(start+7*DAY):null,items:rows.slice(0,limit),has_more:rows.length>limit,total:db.prepare(sql+' SELECT count(*) n FROM ranked').get(...args).n,own})
  })
}
