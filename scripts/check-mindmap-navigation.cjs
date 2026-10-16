const {chromium}=require('playwright')
const assert=require('node:assert/strict')
const base=process.env.RD_UI_TEST_URL||'http://127.0.0.1:5204'
assert.equal(new URL(base).hostname,'127.0.0.1')

async function main(){
  const browser=await chromium.launch({channel:'msedge',headless:true,args:['--disable-gpu']})
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}})
    const errors=[];page.on('pageerror',e=>errors.push(e.message))
    await page.route('**/api/**',route=>{
      const path=new URL(route.request().url()).pathname
      const data=path==='/api/auth/session'?{session:null}:path==='/api/internal/access'?{allowed:false}:path.startsWith('/api/data/')?[]:{}
      return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)})
    })
    await page.goto(base+'/articles/',{waitUntil:'networkidle'})
    await page.locator('.VPNavBarMenu').getByRole('link',{name:'思维导图',exact:true}).click()
    await page.locator('.VPNavBarMenuLink[aria-current="page"]').filter({hasText:'思维导图'}).waitFor()
    assert.equal(await page.locator('.VPNavBarMenuLink.active').count(),1)
    await page.screenshot({path:'artifacts/mindmap-navigation-desktop.png'})
    for(const width of [1440,1280,1200,1100,1024,960,820,390]){
      await page.setViewportSize({width,height:1000})
      await page.evaluate(()=>document.documentElement.dataset.rdInternalAccess='allowed')
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'horizontal overflow at '+width)
      if(width>=960){
        assert.ok(await page.evaluate(()=>{
          const menu=document.querySelector('.VPNavBarMenu').getBoundingClientRect(),account=document.querySelector('.user-nav').getBoundingClientRect(),brand=document.querySelector('.VPNavBarTitle').getBoundingClientRect()
          return menu.left>=brand.right&&menu.right<=account.left+1
        }),'navigation overlaps at '+width)
      }
    }
    await page.locator('.VPNavBarHamburger').click()
    const mobile=page.locator('.VPNavScreenMenuLink').filter({hasText:'思维导图'})
    await mobile.waitFor({state:'visible'})
    assert.equal(await mobile.getAttribute('aria-current'),'page')
    await page.screenshot({path:'artifacts/mindmap-navigation-mobile.png',fullPage:true})
    await page.locator('.VPNavScreenMenuLink').filter({hasText:'知识库'}).click()
    await page.locator('.VPNavBarHamburger').click()
    await page.locator('.VPNavScreenMenuLink[aria-current="page"]').filter({hasText:'知识库'}).waitFor({state:'visible'})
    assert.notEqual(await page.locator('.VPNavScreenMenuLink').filter({hasText:'思维导图'}).getAttribute('aria-current'),'page')
    assert.deepEqual(errors,[])
    console.log('PASS: standalone desktop/mobile mindmap navigation, exclusive active state, navigation switching and eight responsive widths')
  }finally{await browser.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1})
