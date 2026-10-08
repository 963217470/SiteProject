// Explicit local-only browser fixture. Not packaged in production releases.
import express from 'express'
import { randomUUID, createHmac } from 'node:crypto'
import { mkdtempSync, copyFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase } from '../database.mjs'
import { createApp } from '../app.mjs'
const dataDir=mkdtempSync(join(tmpdir(),'rd-tasks-ui-')),db=openDatabase(join(dataDir,'site.sqlite')),secret=randomUUID()+randomUUID(),time=Date.now()
for(const role of ['member','admin']){db.prepare('INSERT INTO users(id,github_id,github_username) VALUES(?,?,?)').run(role,'ui-'+role,role);db.prepare('INSERT INTO profiles(id,username,role) VALUES(?,?,?)').run(role,role==='admin'?'预览管理员':'预览社员',role)}
const backend=createApp(db,{dataDir,sessionSecret:secret,siteUrl:'http://127.0.0.1:5175',production:false,maxUploadMb:100,adminGithubIds:[]})
for(const [id,title,type,target,reward] of [['read','阅读三篇开发笔记','read',3,100],['publish','分享一篇开发实践','publish',1,150],['branch','完善知识库分支','branch',1,100],['jam','参加本月 Game Jam','gamejam',1,300]])db.prepare("INSERT INTO tasks(id,title,description,type,target,reward,status,requirements,created_by,created_at) VALUES(?,?,?,?,?,?,'active',?,'admin',?)").run(id,title,'本地测试任务，用于验证任务领取、进度展示和审核流程。',type,target,reward,JSON.stringify(type==='gamejam'?{url:true,image:true}:{}),time)
db.prepare("INSERT INTO task_enrollments(task_id,user_id,joined_at,activity_baseline) VALUES('read','member',?,0),('jam','member',?,0)").run(time,time)
db.prepare("UPDATE task_enrollments SET state='submitted' WHERE task_id='jam'").run()
db.prepare("INSERT INTO files(id,bucket,path,owner_id,mime,size) VALUES('proof','task-evidence','member/entry.jpg','member','image/jpeg',100)").run()
copyFileSync(new URL('../../docs/public/images/hero-bg.jpg',import.meta.url),join(dataDir,'uploads','proof'))
db.prepare("INSERT INTO task_submissions(id,task_id,user_id,note,url,files,submitted_at) VALUES('submission','jam','member','完成了参赛原型，附作品网址和截图。','https://itch.io/jam/local-preview','[\"proof\"]',?)").run(time)
const app=express()
app.get('/api/__preview/:role',(req,res)=>{
 if(!['admin','member'].includes(req.params.role))return res.sendStatus(404)
 const sid=randomUUID();db.prepare('INSERT INTO sessions(sid,data,expires) VALUES(?,?,?)').run(sid,JSON.stringify({passport:{user:req.params.role},cookie:{originalMaxAge:3600000,expires:new Date(Date.now()+3600000),httpOnly:true,path:'/'}}),Date.now()+3600000)
 res.cookie('rd.sid','s:'+sid+'.'+createHmac('sha256',secret).update(sid).digest('base64').replace(/=+$/,''),{httpOnly:true,sameSite:'lax'});res.redirect(req.params.role==='admin'?'/admin/tasks':'/tasks')
})
app.use(backend)
app.listen(3101,'127.0.0.1',()=>console.log('Local-only task UI fixture listening on 3101'))
