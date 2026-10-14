// Explicit local-only browser fixture. Not packaged in production releases.
import express from 'express'
import { randomUUID, createHmac } from 'node:crypto'
import { mkdtempSync, copyFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { openDatabase } from '../database.mjs'
import { createApp } from '../app.mjs'
const dataDir=mkdtempSync(join(tmpdir(),'rd-tasks-ui-')),db=openDatabase(join(dataDir,'site.sqlite')),secret=randomUUID()+randomUUID(),time=Date.now()
const ids={member:'00000000-0000-4000-8000-000000001001',admin:'00000000-0000-4000-8000-000000001002'}
for(const role of ['member','admin']){db.prepare('INSERT INTO users(id,github_id,github_username) VALUES(?,?,?)').run(ids[role],'ui-'+role,role);db.prepare('INSERT INTO profiles(id,username,role) VALUES(?,?,?)').run(ids[role],role==='admin'?'预览管理员':'预览社员',role)}
const backend=createApp(db,{dataDir,sessionSecret:secret,siteUrl:process.env.RD_UI_PREVIEW_ORIGIN||'http://127.0.0.1:5175',production:false,maxUploadMb:100,adminGithubIds:[]})
const branchRows=[['program',null,'程序'],['art',null,'美术'],['design',null,'策划'],['production',null,'项目实践'],['godot','program','Godot'],['unreal','program','Unreal Engine'],['shader','art','技术美术'],['pixel','art','像素美术'],['level','design','关卡设计'],['jam','production','Game Jam']]
for(const [id,parent,name] of branchRows) db.prepare('INSERT INTO knowledge_branches(id,parent_id,name,slug,description) VALUES(?,?,?,?,?)').run(id,parent,name,id,name+'方向的学习笔记与项目实践。')
for(const [index,branch,title] of [[1,'godot','角色移动与输入缓冲'],[2,'unreal','UE5 安装与项目结构'],[3,'shader','材质与光照基础'],[4,'level','关卡节奏与引导'],[5,'jam','Game Jam 项目复盘']]) db.prepare("INSERT INTO articles(id,title,summary,content,status,author_id,kb_enabled,kb_branch_id) VALUES(?,?,?,?,'published','00000000-0000-4000-8000-000000001002',1,?)").run('00000000-0000-4000-8000-'+String(index).padStart(12,'0'),title,'本地预览笔记，不会上传生产数据库。','# '+title+'\n\n知识图谱本地验证。',branch)
db.prepare("INSERT INTO articles(id,title,content,status,author_id,kb_enabled,kb_branch_id,visibility) VALUES('private-preview','内部项目机密','仅社员可见','published','00000000-0000-4000-8000-000000001002',1,'production','internal')").run()
db.prepare("INSERT INTO articles(id,title,content,status,author_id) VALUES('community-preview','社团开发笔记','# 开发笔记\n\n记录开发中的实践与交流。','published','00000000-0000-4000-8000-000000001002')").run()
db.prepare("INSERT INTO comments(id,article_id,user_id,content,status) VALUES('preview-comment','community-preview','00000000-0000-4000-8000-000000001002','欢迎分享开发经验。','approved')").run()
db.prepare("INSERT INTO comments(id,article_id,user_id,content,status) VALUES('pending-comment','community-preview','00000000-0000-4000-8000-000000001001','这是一条等待审核的评论。','pending')").run()
for(const [id,title,type,target,reward] of [['read','阅读三篇开发笔记','read',3,100],['publish','分享一篇开发实践','publish',1,150],['branch','完善知识库分支','branch',1,100],['jam','参加本月 Game Jam','gamejam',1,300]])db.prepare("INSERT INTO tasks(id,title,description,type,target,reward,status,requirements,created_by,created_at) VALUES(?,?,?,?,?,?,'active',?,'00000000-0000-4000-8000-000000001002',?)").run(id,title,'本地测试任务，用于验证任务领取、进度展示和审核流程。',type,target,reward,JSON.stringify(type==='gamejam'?{url:true,image:true}:{}),time)
db.prepare("INSERT INTO task_enrollments(task_id,user_id,joined_at,activity_baseline) VALUES('read','00000000-0000-4000-8000-000000001001',?,0),('jam','00000000-0000-4000-8000-000000001001',?,0)").run(time,time)
db.prepare("UPDATE task_enrollments SET state='submitted' WHERE task_id='jam'").run()
db.prepare("INSERT INTO files(id,bucket,path,owner_id,mime,size) VALUES('proof','task-evidence','00000000-0000-4000-8000-000000001001/entry.jpg','00000000-0000-4000-8000-000000001001','image/jpeg',100)").run()
copyFileSync(new URL('../../docs/public/images/hero-bg.jpg',import.meta.url),join(dataDir,'uploads','proof'))
db.prepare("INSERT INTO task_submissions(id,task_id,user_id,note,url,files,submitted_at) VALUES('submission','jam','00000000-0000-4000-8000-000000001001','完成了参赛原型，附作品网址和截图。','https://itch.io/jam/local-preview','[\"proof\"]',?)").run(time)
db.prepare("INSERT INTO files VALUES('catalog-cover','catalog','00000000-0000-4000-8000-000000001001/screenshot.jpg','00000000-0000-4000-8000-000000001001','image/jpeg',100)").run()
copyFileSync(new URL('../../docs/public/images/hero-bg.jpg',import.meta.url),join(dataDir,'uploads','catalog-cover'))
for(const [id,kind,title] of [['demo-game','game','开发原型 · 游戏演示'],['demo-tool','tool','素材整理工具']])db.prepare("INSERT INTO catalog_items(id,author_id,kind,title,summary,content,platform,external_url,cover_id,assets,status,created_at,updated_at) VALUES(?,'00000000-0000-4000-8000-000000001001',?,?,? ,?,'Windows','https://pan.baidu.com/s/local-preview','catalog-cover','[\"catalog-cover\"]','published',?,?)").run(id,kind,title,'仅用于本地验证图文介绍、浏览和下载入口。','# '+title+'\n\n![预览](/api/files/catalog/00000000-0000-4000-8000-000000001001/screenshot.jpg)\n\n## 使用说明\n\n- 解压文件\n- 运行程序\n\n```js\nconsole.log("Hello")\n```\n\n$x^2 + y^2 = 1$',new Date(time).toISOString(),new Date(time).toISOString())
const app=express()
db.prepare("UPDATE articles SET tags='[\"Godot\",\"手搓\"]' WHERE id='00000000-0000-4000-8000-000000000001'").run()
db.prepare("UPDATE articles SET tags='[\"视频转文\"]' WHERE id='00000000-0000-4000-8000-000000000002'").run()
app.get('/api/__preview/:role',(req,res)=>{
 if(!['admin','member'].includes(req.params.role))return res.sendStatus(404)
 const sid=randomUUID();db.prepare('INSERT INTO sessions(sid,data,expires) VALUES(?,?,?)').run(sid,JSON.stringify({passport:{user:ids[req.params.role]},cookie:{originalMaxAge:3600000,expires:new Date(Date.now()+3600000),httpOnly:true,path:'/'}}),Date.now()+3600000)
 res.cookie('rd.sid','s:'+sid+'.'+createHmac('sha256',secret).update(sid).digest('base64').replace(/=+$/,''),{httpOnly:true,sameSite:'lax'});res.redirect(req.params.role==='admin'?'/admin/tasks':'/tasks')
})
app.use(backend)
const previewPort=Number(process.env.RD_UI_FIXTURE_PORT||3101)
app.listen(previewPort,'127.0.0.1',()=>console.log('Local-only task UI fixture listening on '+previewPort))
