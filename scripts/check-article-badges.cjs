const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({channel:'msedge',headless:true,args:['--disable-gpu'],timeout:20000});
  const page = await browser.newPage({viewport:{width:1440,height:1000}});
  page.setDefaultTimeout(15000);
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  const base=process.env.RD_UI_TEST_URL||'http://127.0.0.1:5175';
  try {
    await page.goto(base+'/articles');
    await page.locator('.article-badge-knowledge').first().waitFor();
    assert.equal(await page.locator('.article-badge-manual').count(),1);
    assert.equal(await page.locator('.article-badge-video').count(),1);
    assert.equal(await page.locator('.rd-tags button').filter({hasText:'手搓'}).count(),0);
    await page.screenshot({path:path.join(process.env.TEMP,'rd-article-badges-desktop.png'),fullPage:true});
    await page.goto(base+'/api/__preview/admin');
    await page.goto(base+'/article?id=00000000-0000-4000-8000-000000000001');
    await page.locator('.article-reader-badges .article-badge-manual').waitFor();
    assert.equal(await page.locator('.article-reader-badges .article-badge-knowledge').count(),1);
    for(const width of [320,390]) {
      await page.setViewportSize({width,height:900}); await page.goto(base+'/articles'); await page.locator('.article-badge-video').waitFor();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
      for(const badge of await page.locator('.article-badge').all()) assert.equal(await badge.evaluate(e=>e.getBoundingClientRect().right<=innerWidth),true);
      if(width===390)await page.screenshot({path:path.join(process.env.TEMP,'rd-article-badges-mobile.png'),fullPage:true});
    }
    await page.goto(base+'/api/__preview/admin');
    await page.goto(base+'/editor');
    await page.locator('[aria-label="创作方式"]').selectOption('视频转文');
    await page.locator('[aria-label="创作方式"]').selectOption('手搓');
    await page.locator('.title-field input').fill('标签持久化测试');
    await page.locator('[contenteditable="true"]').fill('创作方式随文章一起保存。');
    const response=page.waitForResponse(r=>r.url().includes('/api/data/articles')&&r.request().method()==='POST');
    await page.getByRole('button',{name:'保存草稿',exact:true}).click();
    const result=await response; assert.equal(result.ok(),true);
    const payload=result.request().postDataJSON(); assert.deepEqual(payload.tags,['手搓']);
    const rows=await result.json();const id=rows[0].id;
    const saved=await page.evaluate(async id=>(await window.__api.from('articles').select('tags').eq('id',id).single()).data,id);
    assert.deepEqual(saved.tags,['手搓']);
    assert.deepEqual(errors,[]);
    console.log('PASS: real collection/source badges, detail footer, no duplicate topic markers, 320/390px wrapping, editor source changes and persisted article tags.');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
