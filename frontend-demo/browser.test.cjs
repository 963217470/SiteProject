const { chromium } = require("playwright");
const { pathToFileURL } = require("node:url");
const path = require("node:path");
const fs = require("node:fs");
const assert = require("node:assert/strict");
(async () => {
  console.log("Starting browser...");
  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
    timeout: 20000,
    args: ["--disable-gpu"],
  });
  console.log("Browser started.");
  const errors = [];
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (e) => errors.push(e.message));
  const url = pathToFileURL(path.join(__dirname, "index.html")).href;
  fs.mkdirSync(path.join(__dirname, "screenshots"), { recursive: true });
  try {
    console.log("Opening local page...");
    await page.goto(url, { timeout: 15000, waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    console.log("Local page loaded.");
    assert.equal(await page.locator(".work").count(), 3);
    assert.equal(await page.locator(".post").count(), 6);
    assert.equal(
      await page.locator(".hero canvas").evaluate((c) => {
        const { data } = c
          .getContext("2d")
          .getImageData(0, 0, c.width, c.height);
        const colors = new Set();
        for (let i = 0; i < data.length; i += 4)
          colors.add(`${data[i]},${data[i + 1]},${data[i + 2]}`);
        return colors.size > 15;
      }),
      true,
    );
    const firstPixels = await page
      .locator("#world")
      .evaluate((c) =>
        [
          ...c.getContext("2d").getImageData(0, 0, c.width, c.height).data,
        ].reduce((a, x, i) => (a + x * ((i % 19) + 1)) % 1000000007, 0),
      );
    await page.waitForTimeout(1200);
    const nextPixels = await page
      .locator("#world")
      .evaluate((c) =>
        [
          ...c.getContext("2d").getImageData(0, 0, c.width, c.height).data,
        ].reduce((a, x, i) => (a + x * ((i % 19) + 1)) % 1000000007, 0),
      );
    assert.notEqual(firstPixels, nextPixels);
    await page.locator("#showcase").scrollIntoViewIfNeeded();
    await page.locator("#community").scrollIntoViewIfNeeded();
    await page.locator(".post").last().scrollIntoViewIfNeeded();
    await page.waitForTimeout(800);
    await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({
      path: path.join(__dirname, "screenshots", "desktop.png"),
      fullPage: true,
    });
    await page.locator('nav [data-page="community"]').click();
    await page.locator('[data-filter="组队招募"]').click();
    assert.equal(await page.locator(".post").count(), 1);
    await page.locator('[data-save="p2"]').click();
    await page.locator('[data-filter="收藏"]').click();
    assert.equal(await page.locator(".post").count(), 1);
    await page.reload();
    await page.locator('[data-filter="收藏"]').click();
    assert.equal(await page.locator(".post").count(), 1);
    await page.locator(".post-title").click();
    assert.equal(await page.locator("#detail").evaluate((d) => d.open), true);
    await page.locator("#comment-body").fill("<script>bad()</script>");
    await page.locator("#comment-form button").click();
    assert.match(
      await page.locator(".comment").last().innerText(),
      /<script>bad\(\)<\/script>/,
    );
    assert.equal(await page.locator("#detail-content script").count(), 0);
    await page.keyboard.press("Escape");
    assert.equal(await page.locator("#detail").evaluate((d) => d.open), false);
    await page.locator(".floating").click();
    await page.locator('[name="title"]').fill("我的本地原型");
    await page.locator('[name="body"]').fill("这是本地保存的开发记录。");
    await page.locator('#post-form [type="submit"]').click();
    assert.match(
      await page.locator(".post-title").first().innerText(),
      /我的本地原型/,
    );
    await page.reload();
    assert.match(
      await page.locator(".post-title").first().innerText(),
      /我的本地原型/,
    );
    await page.locator("#checkin-side").click();
    await page.locator("#checkin").click();
    assert.equal(await page.locator("#checkin").isDisabled(), true);
    assert.match(await page.locator(".streak").innerText(), /累计经验 5 EXP/);
    await page.keyboard.press("Escape");
    await page.locator('nav [data-page="knowledge"]').click();
    assert.equal(await page.locator(".note").count(), 6);
    await page.locator(".note").first().click();
    assert.match(await page.locator(".detail-body").innerText(), /土狼时间/);
    await page.keyboard.press("Escape");
    await page.locator('nav [data-page="games"]').click();
    await page.locator(".work").first().click();
    assert.match(await page.locator(".detail-title").innerText(), /赤月旅人/);
    await page.keyboard.press("Escape");
    await page.locator('[data-tool="0"]').click();
    const download = page.waitForEvent("download");
    await page.locator('[data-download-tool="0"]').click();
    assert.equal((await download).suggestedFilename(), "game-jam-plan.md");
    await page.keyboard.press("Escape");
    await page.locator('nav [data-page="about"]').click();
    assert.match(await page.locator("#extra").innerText(), /技术美术/);
    await page.evaluate(() => localStorage.removeItem("rd-studio-demo-v1"));
    for (const width of [390, 320, 768, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(url + "#home");
      await page.reload();
      await page.waitForTimeout(400);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
        `overflow at ${width}`,
      );
      if (width === 390) {
        await page.locator("#showcase").scrollIntoViewIfNeeded();
        await page.locator("#community").scrollIntoViewIfNeeded();
        await page.locator(".post").last().scrollIntoViewIfNeeded();
        await page.waitForTimeout(700);
        await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
        await page.screenshot({
          path: path.join(__dirname, "screenshots", "mobile.png"),
          fullPage: true,
        });
        await page.screenshot({
          path: path.join(__dirname, "screenshots", "mobile-first-screen.png"),
        });
      }
      if (width === 320) {
        await page.locator("#menu").click();
        await page.locator('nav [data-page="knowledge"]').click();
        assert.equal(await page.locator(".note").first().isVisible(), true);
        await page.locator(".note").first().click();
        assert.equal(
          await page
            .locator("#detail")
            .evaluate((d) => d.scrollWidth <= d.clientWidth),
          true,
        );
        await page.keyboard.press("Escape");
      }
    }
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(url + "#home");
    await page.waitForTimeout(300);
    assert.equal(
      await page.evaluate(
        () => getComputedStyle(document.querySelector("#main")).animationName,
      ),
      "none",
    );
    const screenshot1 = await page.locator("#world").screenshot();
    await page.waitForTimeout(500);
    const screenshot2 = await page.locator("#world").screenshot();
    assert.equal(screenshot1.equals(screenshot2), true);
    assert.deepEqual(errors, []);
    console.log(
      "PASS: desktop/mobile/320px/768px/1920px, pixel scene animation, filtering, saved persistence, safe comments, post persistence, check-in, all sections, reduced motion, no JS errors.",
    );
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
