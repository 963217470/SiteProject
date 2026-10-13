const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
(async()=>{
  const browser=await chromium.launch({channel:'msedge',headless:true,args:['--disable-gpu'],timeout:20000});
  const page=await browser.newPage({viewport:{width:1440,height:960}});page.setDefaultTimeout(15000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const base=process.env.RD_UI_TEST_URL||'http://127.0.0.1:5175';
  try{
    for(const width of [1440,1024,768,390,320]){
      await page.setViewportSize({width,height:960});await page.goto(base+'/articles');await page.locator('.rd-article-discussion').first().waitFor();
      assert.equal(await page.locator('.fab-button').count(),0);
      assert.equal(await page.locator('.rd-page-header a[href="/editor"]').count(),1);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'overflow at '+width);
      if(width>1100){const main=await page.locator('.article-community-main').boundingBox();const aside=await page.locator('.article-community-sidebar').boundingBox();assert.ok(aside.x>=main.x+main.width+30);}
      if(width<960){const main=await page.locator('.article-community-main').boundingBox();const aside=await page.locator('.article-community-sidebar').boundingBox();assert.ok(aside.y>=main.y+main.height);}
      if([1440,390].includes(width))await page.screenshot({path:path.join(process.env.TEMP,'rd-article-community-'+width+'.png'),fullPage:true});
      if(width===1440){await page.getByLabel('网格视图',{exact:true}).click();assert.equal(await page.locator('.rd-article-grid').count(),1);await page.getByLabel('列表视图',{exact:true}).click();await page.locator('.article-community-topic').first().click();assert.ok((await page.locator('.rd-filter-summary').innerText()).includes('Godot'));await page.getByRole('button',{name:'清除标签筛选',exact:true}).click();await page.getByLabel('搜索文章或标签',{exact:true}).fill('UE5');assert.equal(await page.locator('.rd-article').count(),1);await page.getByLabel('搜索文章或标签',{exact:true}).fill('');}
      await page.evaluate(()=>document.documentElement.classList.add('dark'));await page.waitForTimeout(250);assert.equal(await page.locator('.rd-article').first().evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(32, 32, 35)');await page.evaluate(()=>document.documentElement.classList.remove('dark'));
    }
    await page.goto(base+'/');await page.locator('.home-community').waitFor();assert.equal(await page.locator('.home-community .article-community-sidebar').count(),0);
    assert.deepEqual(errors,[]);console.log('PASS: 1440/1024/768/390/320px, sidebar stacking, no horizontal overflow or duplicate floating composer, list/grid, search, actual tag filters, dark cards, homepage preserved.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
