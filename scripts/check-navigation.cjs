const {chromium}=require('playwright')
const assert=require('node:assert/strict')
const {join}=require('node:path')
const base=process.env.RD_UI_TEST_URL||'http://127.0.0.1:5190'
const menu=[['/','首页'],['/articles/','文章'],['/kb/','知识库'],['/tasks/','任务'],['/games-tools/','游戏/工具'],['/internal/','内部'],['/about/','关于']]
async function verify(page,label,mobile=false) {
  const root=mobile?'.VPNavScreen':'.VPNavBarMenu'
  const selector=mobile?'.VPNavScreenMenuLink[aria-current="page"]':'.VPNavBarMenuLink.active'
  const current=page.locator(root+' '+selector)
  await current.waitFor()
  assert.equal(await current.count(),1)
  assert.equal((await current.innerText()).trim(),label)
  assert.equal(await current.getAttribute('aria-current'),'page')
  await page.waitForFunction(({root,selector,mobile})=>{
    const selected=document.querySelector(root+' '+selector)
    const line=getComputedStyle(mobile?selected.firstElementChild:selected,'::after')
    return line.content!=='none'&&parseFloat(line.width)>=17.9&&line.height==='3px'&&line.backgroundColor!=='rgba(0, 0, 0, 0)'&&line.opacity!=='0'
  },{root,selector,mobile})
  if(mobile)await page.waitForFunction(()=>getComputedStyle(document.querySelector('.VPNavScreen')).opacity==='1')
}
async function main() {
  const browser=await chromium.launch({channel:'msedge',headless:true,args:['--disable-gpu']})
  try {
    const page=await browser.newPage({viewport:{width:1440,height:1000}})
    const errors=[];page.on('pageerror',e=>errors.push(e.message))
    if(new URL(base).hostname==='127.0.0.1')await page.goto(base+'/api/__preview/admin',{waitUntil:'domcontentloaded'})
    for(const [path,label] of menu) {
      if(label==='内部'&&new URL(base).hostname!=='127.0.0.1')continue
      await page.goto(base+path,{waitUntil:'domcontentloaded'});await verify(page,label)
    }
    if(new URL(base).hostname==='127.0.0.1')for(const [path,label] of [['/article?id=community-preview','文章'],['/editor/','文章'],['/admin/kb','知识库'],['/admin/tasks/','任务']]) {
      await page.goto(base+path,{waitUntil:'domcontentloaded'});await verify(page,label)
    }
    await page.goto(base+'/games-tools/',{waitUntil:'domcontentloaded'});await verify(page,'游戏/工具')
    await page.locator('.VPNavBarMenuLink').filter({hasText:'关于'}).click();await verify(page,'关于')
    await page.goBack();await verify(page,'游戏/工具')
    await page.screenshot({path:join(process.env.TEMP,'rd-navigation-desktop.png')})
    await page.setViewportSize({width:390,height:844})
    for(const [path,label] of menu) {
      if(label==='内部'&&new URL(base).hostname!=='127.0.0.1')continue
      await page.goto(base+path,{waitUntil:'domcontentloaded'})
      await page.locator('.VPNavBarHamburger').click()
      await verify(page,label,true)
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
    }
    await page.screenshot({path:join(process.env.TEMP,'rd-navigation-mobile.png')})
    assert.deepEqual(errors,[])
    console.log('Navigation selection, red underline, child pages, history and mobile menu checks passed.')
  }finally{await browser.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1})
