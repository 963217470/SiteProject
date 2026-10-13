const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
function luminance(color) {
  const rgb = color.match(/[\d.]+/g).slice(0, 3).map(Number).map(n => { const v = n / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; });
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
async function contrast(locator) {
  const colors = await locator.evaluate(el => { const s = getComputedStyle(el); return { color: s.color, background: s.backgroundColor }; });
  const a = luminance(colors.color), b = luminance(colors.background);
  assert.ok((Math.max(a, b) + .05) / (Math.min(a, b) + .05) >= 4.5, JSON.stringify(colors));
}
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu'], timeout: 20000 });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  page.setDefaultTimeout(15000);
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  const base = process.env.RD_UI_TEST_URL || 'http://127.0.0.1:5175';
  try {
    await page.goto(base); const login = page.locator('.VPNavBar .login-link'); await login.waitFor();
    assert.equal(await login.innerText(), '登录'); await contrast(login);
    await login.hover(); await page.waitForTimeout(250); await contrast(login);
    await page.mouse.move(0, 0); await login.focus(); await contrast(login);
    await page.locator('.community-links').scrollIntoViewIfNeeded(); await page.waitForTimeout(200); await contrast(login);
    const entry = page.locator('.community-links a').first(); await entry.hover(); await page.waitForTimeout(250);
    assert.notEqual(await entry.evaluate(e => getComputedStyle(e).transform), 'none');
    assert.equal(await entry.evaluate(e => getComputedStyle(e).borderRadius), '8px');
    await page.screenshot({ path: path.join(process.env.TEMP, 'rd-youthful-home.png'), fullPage: true });
    await page.goto(base + '/articles'); await page.locator('.rd-article').first().waitFor(); await contrast(login);
    assert.ok(await page.locator('.rd-view-modes svg').first().evaluate(e => e.getBoundingClientRect().width >= 18));
    await page.screenshot({ path: path.join(process.env.TEMP, 'rd-youthful-articles.png'), fullPage: true });
    for (const width of [320, 390, 1024, 1440]) {
      await page.setViewportSize({ width, height: 900 }); await page.goto(base); await login.waitFor(); await contrast(login);
      if (!(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))) console.log(await page.evaluate(() => [...document.querySelectorAll('body *')].map(e => ({ cls:e.className, right:e.getBoundingClientRect().right, width:e.getBoundingClientRect().width })).filter(e => e.right > innerWidth + 1).slice(0, 15)));
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'overflow at ' + width);
      if (width === 390) await page.screenshot({ path: path.join(process.env.TEMP, 'rd-youthful-mobile.png'), fullPage: true });
      await page.evaluate(() => document.documentElement.classList.add('dark')); await contrast(login);
      await page.evaluate(() => document.documentElement.classList.remove('dark'));
    }
    await page.emulateMedia({ reducedMotion: 'reduce' }); await page.goto(base); await entry.scrollIntoViewIfNeeded(); await entry.hover(); assert.equal(await entry.evaluate(e => getComputedStyle(e).transform), 'none');
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await page.goto(base + '/api/__preview/admin'); await page.locator('.user-menu').waitFor();
    await page.goto(base); await page.locator('.user-name').waitFor();
    assert.notEqual(await page.locator('.user-name').evaluate(e => getComputedStyle(e).color), 'rgb(255, 255, 255)');
    await page.locator('.user-menu').click(); await page.locator('.user-dropdown a[href="/admin"]').waitFor();
    await page.goto(base + '/tasks'); await page.locator('.task-item').first().waitFor(); await page.screenshot({ path: path.join(process.env.TEMP, 'rd-youthful-tasks.png'), fullPage: true });
    await page.goto(base + '/games-tools/'); await page.locator('.catalog-card').first().waitFor(); assert.equal(await page.locator('.catalog-card').first().evaluate(e => getComputedStyle(e).borderRadius), '8px');
    await page.locator('.catalog-card-open').first().click(); await page.locator('.catalog-detail').waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS: login contrast >=4.5 normal/hover/focus/scrolled/light/dark/mobile; responsive 320/390/1024/1440px; card hover/reduced motion; account, tasks and catalog detail remain functional.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
