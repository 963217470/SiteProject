const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const context = vm.createContext({ Intl, Date });
vm.runInContext(
  fs.readFileSync(require("node:path").join(__dirname, "model.js"), "utf8"),
  context,
);
const M = context.RDModel;
test("invalid stored data becomes usable defaults", () => {
  assert.equal(M.hydrate(null).posts.length, 0);
  const s = M.hydrate({
    posts: [null, { id: "x", title: "bad" }],
    exp: -5,
    saved: ["p1", "p1", null],
    comments: { p1: [{ body: "hello" }, null, { body: "" }] },
  });
  assert.equal(s.posts.length, 0);
  assert.equal(s.exp, 0);
  assert.equal(s.saved.length, 1);
  assert.equal(s.comments.p1.length, 1);
});
test("search and category filters combine; favorites only show saved items", () => {
  const s = M.fresh();
  s.saved = ["p1"];
  assert.equal(M.filter(M.posts, s, "收藏", "", "latest").length, 1);
  assert.equal(M.filter(M.posts, s, "组队招募", "Jam", "latest")[0].id, "p2");
  assert.equal(M.filter(M.posts, s, "美术音效", "Godot", "latest").length, 0);
  assert.equal(M.filter(M.posts, s, "全部", "", "hot")[0].id, "p4");
});
test("check-in is once per Shanghai calendar day, streak resets after gaps", () => {
  const s = M.fresh();
  const now = new Date("2026-10-12T16:01:00Z");
  assert.equal(M.day(now), "2026-10-13");
  assert.equal(M.checkin(s, now), true);
  assert.equal(s.exp, 5);
  assert.equal(M.checkin(s, now), false);
  assert.equal(s.exp, 5);
  M.checkin(s, new Date("2026-10-13T16:01:00Z"));
  assert.equal(s.streak, 2);
  M.checkin(s, new Date("2026-10-16T16:01:00Z"));
  assert.equal(s.streak, 1);
});
test("seven continuous days add five bonus experience without consuming experience", () => {
  const s = M.fresh();
  for (let i = 0; i < 7; i++)
    M.checkin(s, new Date(Date.UTC(2026, 9, 1 + i, 8)));
  assert.equal(s.exp, 40);
  assert.equal(s.streak, 7);
});
test("user input is escaped before entering HTML", () => {
  assert.equal(
    M.escape('<img src=x onerror="alert(1)">'),
    "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
  );
});
test("valid local posts and comments survive reload", () => {
  const s = M.fresh();
  s.posts.push({
    id: "test",
    title: "Hello",
    body: "world",
    category: "游戏开发",
    date: "2026-10-12T08:00:00Z",
  });
  s.comments.test = [{ author: "你", body: "Nice" }];
  const restored = M.hydrate(JSON.parse(JSON.stringify(s)));
  assert.equal(restored.posts[0].title, "Hello");
  assert.equal(restored.comments.test[0].body, "Nice");
});
