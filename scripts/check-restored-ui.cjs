const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
(async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true, args: ['--disable-gpu'], timeout: 20000 });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    const url = process.env.RD_UI_TEST_URL || 'http://127.0.0.1:5175';
    await page.goto(url);
    for (const title of ['首页', '文章', '知识库', '任务', '游戏/工具', '内部', '关于']) assert.equal(await page.locator('.VPNavBarMenuLink').filter({ hasText: title }).count(), 1);
    await page.goto(url + '/api/__preview/admin');
    await page.locator('.user-menu').waitFor(); await page.locator('.user-menu').click();
    await page.locator('.user-dropdown a[href="/admin"]').waitFor();
    for (const title of ['个人主页', '我的发布', '我的收藏', '浏览记录', '我的任务', '个人设置', '每日签到', '消息', '管理后台']) assert.equal(await page.locator('.user-dropdown .dropdown-item').filter({ hasText: title }).count(), 1, title);
    await page.locator('.user-dropdown').getByText('每日签到', { exact: true }).click();
    await page.locator('dialog[open]').waitFor(); await page.keyboard.press('Escape');
    await page.goto(url + '/kb'); await page.locator('.knowledge-reading .rd-article').first().waitFor();
    assert.ok(await page.locator('.knowledge-reading .rd-article-counts').count() >= 5);
    assert.equal(await page.locator('.knowledge-actions').getByText('添加子分支', { exact: true }).count(), 1);
    await page.getByRole('button', { name: '目录', exact: true }).click(); await page.locator('.knowledge-directory-row').first().waitFor();
    await page.screenshot({ path: path.join(process.env.TEMP, 'rd-restored-knowledge-desktop.png'), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 }); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.screenshot({ path: path.join(process.env.TEMP, 'rd-restored-knowledge-mobile.png'), fullPage: true });
    await page.goto(url + '/user/profile'); await page.locator('#profile-page').waitFor();
    await page.goto(url + '/editor'); await page.locator('.editor-shell').waitFor();
    await page.goto(url + '/games-tools/'); await page.locator('.catalog-card').first().waitFor();
    await page.goto(url + '/messages/'); await page.locator('.community-page').waitFor();
    await page.goto(url + '/articles'); await page.locator('.rd-article').first().waitFor();
    await page.goto(url + '/article?id=community-preview'); await page.locator('#article-page').waitFor();
    assert.deepEqual(errors, []);
    console.log('PASS: complete navigation, account functions, check-in dialog, knowledge graph/directory/cards/admin controls, mobile layout, profile/editor/catalog/messages/article routes.');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
