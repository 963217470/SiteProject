const {chromium}=require('playwright')
const assert=require('node:assert/strict')
const base=process.env.RD_UI_TEST_URL||'http://127.0.0.1:5200'
assert.equal(new URL(base).hostname,'127.0.0.1')
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jhF8AAAAASUVORK5CYII=','base64')

async function open(page,role){
  await page.goto(base+'/api/__preview/'+role,{waitUntil:'networkidle'})
  const dialog=page.locator('.checkin-dialog[open]')
  if(await dialog.count())await dialog.getByRole('button',{name:'完成',exact:true}).click()
  await page.goto(base+'/user/profile?tab=settings',{waitUntil:'networkidle'})
  await page.locator('#settings-username').waitFor()
}
async function main(){
  const b=await chromium.launch({channel:'msedge',headless:true,args:['--disable-gpu']})
  try{
    const admin=await b.newPage({viewport:{width:1440,height:1000}}),member=await b.newPage({viewport:{width:390,height:844}})
    const errors=[];for(const p of [admin,member])p.on('pageerror',e=>errors.push(e.message))
    await open(admin,'admin')
    const overview=await (await admin.request.get(base+'/api/admin/overview')).json()
    const pendingBefore=overview.queues.find(q=>q.kind==='profile').count
    await admin.locator('#settings-username').fill('管理员资料即刻生效')
    await admin.locator('#settings-bio').fill('无需自己审核自己')
    await admin.locator('#avatar-input').setInputFiles({name:'avatar.png',mimeType:'image/png',buffer:png})
    await admin.waitForFunction(()=>!!document.getElementById('settings-avatar').dataset.uploadedUrl)
    const submitted=admin.waitForResponse(r=>r.request().method()==='POST'&&r.url().includes('/api/data/profile_changes'))
    await admin.getByRole('button',{name:'保存资料',exact:true}).click()
    const row=(await (await submitted).json())[0]
    assert.equal(row.status,'approved')
    await admin.locator('#settings-success').filter({hasText:'自动通过'}).waitFor()
    assert.equal(await admin.locator('#profile-name').innerText(),'管理员资料即刻生效')
    await admin.locator('.user-name').filter({hasText:'管理员资料即刻生效'}).waitFor()
    assert.equal(await admin.locator('#profile-avatar').getAttribute('src'),row.avatar_url)
    assert.equal(await admin.locator('.user-avatar-sm').first().getAttribute('src'),row.avatar_url)
    const after=await (await admin.request.get(base+'/api/admin/overview')).json()
    assert.equal(after.queues.find(q=>q.kind==='profile').count,pendingBefore)
    await admin.screenshot({path:'artifacts/admin-self-profile-desktop.png',fullPage:true})
    await admin.reload({waitUntil:'networkidle'})
    await admin.locator('#profile-name').filter({hasText:'管理员资料即刻生效'}).waitFor()
    await open(member,'member')
    const original=await member.locator('#profile-name').innerText()
    await member.locator('#settings-username').fill('等待审核的昵称')
    await member.getByRole('button',{name:'提交审核',exact:true}).click()
    await member.locator('#settings-success').filter({hasText:'等待管理员审核'}).waitFor()
    assert.equal(await member.locator('#profile-name').innerText(),original)
    await member.screenshot({path:'artifacts/member-profile-pending-mobile.png',fullPage:true})
    assert.ok(await member.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
    assert.deepEqual(errors,[])
    console.log('PASS: admin name/bio/avatar immediately approved, header and nav refreshed, review queue unchanged, persistence, normal member remains pending and responsive settings')
  }finally{await b.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1})
