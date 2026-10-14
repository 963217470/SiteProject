const {chromium}=require('playwright')
const assert=require('node:assert/strict')
const {join}=require('node:path')
const base=process.env.RD_UI_TEST_URL||'http://127.0.0.1:5190'
assert.equal(new URL(base).hostname,'127.0.0.1','Permission tests write only to the local fixture')
async function graphReady(page) {
  await page.waitForFunction(()=>document.querySelector('.knowledge-stage')?._cyreg?.cy?.nodes().length>0)
  assert.equal(await page.locator('.knowledge-fallback').count(),0)
}
async function point(page,id) {
  return page.locator('.knowledge-stage').evaluate((el,id)=>{
    const cy=el._cyreg.cy,node=cy.getElementById(id),r=node.renderedPosition(),box=el.getBoundingClientRect()
    return {position:{...node.position()},locked:node.locked(),zoom:cy.zoom(),x:box.left+r.x,y:box.top+r.y}
  },id)
}
async function api(page,path,method='GET',body) {
  const response=await page.request.fetch(base+'/api'+path,{method,headers:{'X-RD-CSRF':'1'},...(body?{data:body}:{})})
  assert.ok(response.ok(),await response.text());return response.json()
}
async function main() {
  const browser=await chromium.launch({channel:'msedge',headless:true,args:['--disable-gpu']})
  const errors=[]
  try {
    const member=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'no-preference'})
    const admin=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'no-preference'})
    for(const page of [member,admin]){page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push(e.message))}
    await member.goto(base+'/api/__preview/member',{waitUntil:'domcontentloaded'})
    const owner=(await api(member,'/auth/session')).session.user.id
    await admin.goto(base+'/api/__preview/admin',{waitUntil:'domcontentloaded'})
    const stamp=Date.now()
    const parent=(await api(admin,'/data/knowledge_branches','POST',{name:'权限测试上级',slug:'parent-'+stamp}))[0]
    const own=(await api(admin,'/data/knowledge_branches','POST',{name:'我的测试节点',slug:'own-'+stamp,parent_id:parent.id,created_by:owner}))[0]
    const child=(await api(admin,'/data/knowledge_branches','POST',{name:'他人的子节点',slug:'child-'+stamp,parent_id:own.id}))[0]
    const note=(await api(member,'/data/articles','POST',{title:'权限测试笔记',content:'# 保留文章',kb_enabled:true,kb_branch_id:own.id}))[0]
    await api(admin,'/data/articles?id=eq.'+note.id,'PATCH',{status:'published'})
    await admin.goto(base+'/kb/?branch='+own.id,{waitUntil:'domcontentloaded'});await graphReady(admin)
    await admin.locator('.knowledge-stage').scrollIntoViewIfNeeded()
    let writes=0
    admin.on('request',r=>{if(r.method()==='PUT'&&r.url().includes('/knowledge/'))writes++})
    const before=await point(admin,'b:'+own.id)
    await admin.mouse.move(before.x+20,before.y)
    await admin.waitForFunction(({id,position,zoom})=>{
      const n=document.querySelector('.knowledge-stage')._cyreg.cy.getElementById(id).position()
      const d=Math.hypot(n.x-position.x,n.y-position.y)*zoom
      return d>.2&&d<=5.1
    },{id:'b:'+own.id,position:before.position,zoom:before.zoom})
    assert.equal(writes,0,'Pointer feedback must not persist positions')
    await admin.mouse.move(0,0)
    await admin.waitForFunction(({id,position})=>{
      const n=document.querySelector('.knowledge-stage')._cyreg.cy.getElementById(id).position()
      return Math.hypot(n.x-position.x,n.y-position.y)<.001
    },{id:'b:'+own.id,position:before.position})
    await admin.emulateMedia({reducedMotion:'reduce'})
    await admin.mouse.move(before.x+20,before.y)
    await admin.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
    assert.deepEqual((await point(admin,'b:'+own.id)).position,before.position)
    await admin.emulateMedia({reducedMotion:'no-preference'})
    await admin.mouse.move(0,0)
    const pinnedResponse=admin.waitForResponse(r=>r.request().method()==='PUT'&&r.url().includes('/position'))
    await admin.getByRole('button',{name:'固定位置',exact:true}).click()
    assert.ok((await pinnedResponse).ok())
    await admin.getByText('位置已固定',{exact:true}).waitFor()
    const saved=(await api(admin,'/knowledge/positions')).items.find(p=>p.node_id==='b:'+own.id)
    assert.ok(saved)
    await admin.locator('.knowledge-stage').scrollIntoViewIfNeeded()
    const drag=await point(admin,saved.node_id)
    const dragResponse=admin.waitForResponse(r=>r.request().method()==='PUT'&&r.url().includes('/position'))
    await admin.mouse.move(drag.x,drag.y);await admin.mouse.down()
    await admin.mouse.move(drag.x+35,drag.y+20,{steps:8});await admin.mouse.up()
    assert.ok((await dragResponse).ok())
    const moved=(await api(admin,'/knowledge/positions')).items.find(p=>p.node_id===saved.node_id)
    assert.ok(Math.hypot(moved.x-saved.x,moved.y-saved.y)>.1)
    Object.assign(saved,moved)
    await admin.reload({waitUntil:'domcontentloaded'});await graphReady(admin)
    assert.deepEqual((await point(admin,saved.node_id)).position,{x:saved.x,y:saved.y})
    await member.goto(base+'/kb/?branch='+own.id,{waitUntil:'domcontentloaded'});await graphReady(member)
    assert.equal(await member.getByRole('button',{name:'固定位置',exact:true}).count(),0)
    assert.equal(await member.getByRole('button',{name:'取消固定',exact:true}).count(),0)
    const locked=await point(member,saved.node_id)
    assert.equal(locked.locked,false);assert.deepEqual(locked.position,{x:saved.x,y:saved.y})
    assert.equal(await member.locator('.knowledge-stage').evaluate((el,id)=>el._cyreg.cy.getElementById(id).grabbable(),saved.node_id),false)
    await member.mouse.move(locked.x+20,locked.y)
    await member.waitForFunction(({id,x,y})=>{const cy=document.querySelector('.knowledge-stage')._cyreg.cy,p=cy.getElementById(id).position();const d=Math.hypot(p.x-x,p.y-y)*cy.zoom();return d>.1&&d<=5.1},{id:saved.node_id,x:saved.x,y:saved.y})
    await member.mouse.move(0,0)
    await member.waitForFunction(({id,x,y})=>{const p=document.querySelector('.knowledge-stage')._cyreg.cy.getElementById(id).position();return Math.hypot(p.x-x,p.y-y)<.001},{id:saved.node_id,x:saved.x,y:saved.y})
    await member.getByRole('button',{name:'删除节点',exact:true}).click()
    await member.getByRole('button',{name:'确认删除节点',exact:true}).click()
    await member.getByRole('heading',{name:'权限测试上级',exact:true}).waitFor()
    const kept=(await api(member,'/data/articles?id=eq.'+note.id))[0]
    assert.equal(kept.status,'published');assert.equal(kept.kb_branch_id,parent.id)
    assert.equal((await api(admin,'/data/knowledge_branches?id=eq.'+child.id))[0].parent_id,parent.id)
    assert.equal((await api(admin,'/knowledge/positions')).items.some(p=>p.node_id===saved.node_id),false)
    await member.goto(base+'/kb/?branch='+child.id,{waitUntil:'domcontentloaded'});await graphReady(member)
    assert.equal(await member.getByRole('button',{name:'删除节点',exact:true}).count(),0)
    await admin.goto(base+'/kb/?branch='+child.id,{waitUntil:'domcontentloaded'});await graphReady(admin)
    assert.equal(await admin.getByRole('button',{name:'删除节点',exact:true}).count(),1)
    await admin.getByRole('button',{name:'固定位置',exact:true}).click()
    await admin.getByRole('button',{name:'取消固定',exact:true}).waitFor()
    await admin.getByRole('button',{name:'取消固定',exact:true}).click()
    await admin.getByRole('button',{name:'固定位置',exact:true}).waitFor()
    const painted=await admin.locator('.knowledge-stage canvas').evaluateAll(canvases=>canvases.some(canvas=>{
      const data=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data
      for(let i=3;i<data.length;i+=64)if(data[i]>0)return true
      return false
    }))
    assert.equal(painted,true,'Knowledge canvas must not be blank')
    await admin.screenshot({path:join(process.env.TEMP,'rd-knowledge-permissions-desktop.png')})
    await admin.setViewportSize({width:390,height:844});await admin.reload({waitUntil:'domcontentloaded'});await graphReady(admin)
    assert.equal(await admin.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
    const mobile=await point(admin,'b:'+child.id)
    await admin.mouse.move(mobile.x+20,mobile.y)
    await admin.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
    assert.deepEqual((await point(admin,'b:'+child.id)).position,mobile.position)
    await admin.screenshot({path:join(process.env.TEMP,'rd-knowledge-permissions-mobile.png')})
    await member.goto(base+'/kb/?branch='+note.id,{waitUntil:'domcontentloaded'});await graphReady(member)
    await member.getByRole('button',{name:'删除节点',exact:true}).click()
    await member.getByRole('button',{name:'确认删除节点',exact:true}).click()
    await member.getByRole('heading',{name:'权限测试上级',exact:true}).waitFor()
    const detached=(await api(member,'/data/articles?id=eq.'+note.id))[0]
    assert.equal(detached.status,'published');assert.equal(detached.kb_enabled,false)
    assert.deepEqual(errors,[])
    console.log('Knowledge ownership, persistent pins, pointer motion, retained content and responsive canvas checks passed.')
  }finally{await browser.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1})
