const {chromium}=require('playwright')
const assert=require('node:assert/strict')
const base=process.env.RD_UI_TEST_URL||'http://127.0.0.1:5193'
assert.equal(new URL(base).hostname,'127.0.0.1')
const destinations=[['/admin/','管理总览'],['/admin/articles','文章审核'],['/admin/comments/','评论审核'],['/games-tools/?scope=review','游戏/工具审核'],['/admin/profile-review','个人信息审核'],['/admin/kb','知识库管理'],['/admin/tasks','任务管理'],['/admin/tasks?view=reviews','证明审核'],['/admin/tasks?view=people','用户与经验'],['/admin/tasks?view=levels','用户与经验']]
async function main(){
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--disable-gpu']})
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[]
  page.on('pageerror',e=>errors.push(e.message))
  await page.goto(base+'/api/__preview/admin')
  let canonical
  for(const [path,label] of destinations){
    await page.goto(base+path,{waitUntil:'networkidle'})
    const nav=page.getByRole('navigation',{name:'管理后台导航',exact:true})
    await nav.waitFor();assert.equal(await nav.count(),1)
    const links=await nav.locator('.admin-nav-links a').evaluateAll(links=>links.map(a=>[a.textContent.trim(),a.getAttribute('href')]))
    if(!canonical)canonical=links;else assert.deepEqual(links,canonical)
    assert.equal(await nav.locator('[aria-current="page"]').innerText(),label)
    assert.equal(await page.locator('.admin-section-nav').count(),0)
    if(path==='/admin/articles'){
      await page.locator('#admin-page #loading').waitFor({state:'hidden'})
      assert.ok(Number(await page.locator('#stat-total').innerText())>0)
    }
    if(path==='/admin/profile-review')await page.locator('#profile-review-page #loading').waitFor({state:'hidden'})
    if(path==='/admin/kb')await page.locator('#kb-admin-page #loading').waitFor({state:'hidden'})
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),path+' overflows')
  }
  await page.getByRole('button',{name:'证明审核',exact:true}).click()
  await page.waitForFunction(()=>document.querySelector('.admin-workspace-nav [aria-current=page]')?.textContent.trim()==='证明审核')
  assert.ok(new URL(page.url()).searchParams.get('view')==='reviews')
  await page.locator('.admin-nav-links').getByRole('link',{name:'文章审核',exact:true}).click()
  await page.getByRole('heading',{name:'文章审核',exact:true}).waitFor()
  await page.locator('#admin-page #loading').waitFor({state:'hidden'})
  await page.screenshot({path:'artifacts/admin-navigation-desktop.png',fullPage:true})
  await page.setViewportSize({width:390,height:844})
  const select=page.getByRole('combobox',{name:'切换管理页面'})
  await select.waitFor();assert.equal(await select.inputValue(),'articles')
  await select.selectOption('people')
  await page.getByRole('heading',{name:'社员职位',exact:true}).waitFor()
  assert.equal(await select.inputValue(),'people')
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
  await page.screenshot({path:'artifacts/admin-navigation-mobile.png',fullPage:true})
  await page.setViewportSize({width:320,height:844})
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
  await page.goto(base+'/articles/',{waitUntil:'networkidle'})
  assert.equal(await page.locator('.admin-workspace-nav').count(),0)
  assert.deepEqual(errors,[])
  console.log('PASS: identical navigation on 10 admin views, one active item, task tab sync, native links, mobile selector, 320/390/1440 layouts')
 }finally{await browser.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1})
