const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu'], timeout: 20000 });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const base = process.env.RD_UI_TEST_URL || 'http://127.0.0.1:5175';
  try {
    await page.goto(base + '/api/__preview/admin');
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(base + '/user/profile?tab=articles');
      await page.locator('#profile-app').waitFor({ state: 'visible' });
      await page.locator('#panel-articles .panel-head').waitFor();
      assert.equal(await page.locator('.fab-button').count(), 0);
      assert.equal(await page.locator('#panel-articles a[href="/editor"]').count(), 1);
      const side = await page.locator('.profile-sidebar').boundingBox();
      const main = await page.locator('.profile-main').boundingBox();
      if (width > 767) assert.ok(main.x - (side.x + side.width) >= 32, 'desktop column gap at ' + width);
      else assert.ok(main.y - (side.y + side.height) >= 24, 'mobile vertical gap at ' + width);
      if (width === 768) { await page.locator('.VPNavBarHamburger').click(); await page.locator('.VPNavScreen').waitFor({state:'visible'}); await page.locator('.VPNavBarHamburger').click(); }
      if (!(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))) console.log(await page.evaluate(() => [...document.querySelectorAll('body *')].map(e=>({cls:e.className,right:e.getBoundingClientRect().right,width:e.getBoundingClientRect().width})).filter(e=>e.right>innerWidth+1).slice(0,12)));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'overflow at ' + width);
      for (const tab of ['favorites', 'recent', 'settings', 'articles']) {
        await page.locator('#tab-' + tab).click();
        await page.locator('#panel-' + tab).waitFor({ state: 'visible' });
        assert.equal(await page.locator('.profile-tabs button.active').getAttribute('id'), 'tab-' + tab);
        assert.ok(page.url().endsWith('tab=' + tab));
      }
      await page.screenshot({ path: path.join(process.env.TEMP, 'rd-profile-fixed-' + width + '.png'), fullPage: true });
    }
    assert.deepEqual(errors, []);
    console.log('PASS: profile layout 1440/1024/768/390/320px, >=32px desktop separation, >=24px mobile separation, no horizontal overflow, all four tabs and URL state functional.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
