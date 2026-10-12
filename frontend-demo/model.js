(function (root) {
  "use strict";
  const categories = ["作品试玩", "游戏开发", "组队招募", "美术音效"];
  const posts = [
    {
      id: "p1",
      title: "用 Godot 做了一个跳跃手感原型，想听听大家的建议",
      author: "小林同学",
      category: "游戏开发",
      body: "最近在研究土狼时间和跳跃缓冲。给角色加了 0.12 秒的容错后，手感自然了很多。\n\n现在的问题是：下落速度和起跳速度要不要分开调整？欢迎分享你做平台跳跃时的经验。",
      likes: 24,
      comments: [
        { author: "阿叶", body: "可以试试上升和下落使用不同的重力倍率！" },
      ],
      date: "2026-10-12T08:00:00Z",
    },
    {
      id: "p2",
      title: "48h Game Jam 组队：还差一个喜欢奇怪点子的美术",
      author: "陈一",
      category: "组队招募",
      body: "我们准备做一个「整理记忆」的轻量解谜游戏。目前有程序和策划，想找一位美术伙伴。\n\n不限画风，更看重一起讨论和完成作品的过程。欢迎在评论里聊聊你想做的游戏。",
      likes: 18,
      comments: [],
      date: "2026-10-11T12:00:00Z",
    },
    {
      id: "p3",
      title: "森林来信：第一版探索地图和一些不太成熟的想法",
      author: "阿叶",
      category: "作品试玩",
      body: "一个关于森林、信件和相遇的小世界。我们先做了行走、对话与拾取。\n\n希望让每一封信都能连接两个角色。下一步是加入昼夜变化和环境音。",
      likes: 36,
      comments: [{ author: "小林同学", body: "喜欢这个想法，期待下一版！" }],
      date: "2026-10-10T09:00:00Z",
    },
    {
      id: "p4",
      title: "像素美术练习：用 16 色画一间红屋顶的小屋",
      author: "安安",
      category: "美术音效",
      body: "这次把颜色限制在 16 色以内。屋顶用了暖红和暗红，墙面用淡黄，阴影里加入一点紫色。\n\n限制反而让选择更明确了。大家会先选调色板，还是画完再统一颜色？",
      likes: 42,
      comments: [],
      date: "2026-10-09T10:00:00Z",
    },
    {
      id: "p5",
      title: "开发日志 03：给星屿加上了第一套拼图规则",
      author: "晓枫",
      category: "游戏开发",
      body: "终于把漂浮岛屿之间的连接做出来了。现在玩家可以旋转岛屿，让小路连接起来。\n\n目标是不用长篇教程，让玩家通过试错理解规则。正在思考如何提示下一步而不直接给答案。",
      likes: 15,
      comments: [],
      date: "2026-10-08T11:00:00Z",
    },
    {
      id: "p6",
      title: "分享几种让环境音更有层次的小办法",
      author: "风铃",
      category: "美术音效",
      body: "把持续的风声和偶尔出现的鸟鸣分开，再给近处与远处不同的音量和混响。\n\n不需要很多素材，合理留白也能让环境鲜活起来。欢迎分享你最喜欢的游戏声音设计。",
      likes: 21,
      comments: [],
      date: "2026-10-07T11:00:00Z",
    },
  ];
  const works = [
    {
      id: "moon",
      title: "赤月旅人",
      subtitle: "在月落之前，找到回家的路。",
      type: "2D PLATFORMER",
      status: "开发中",
      color: "moon",
      body: "一个围绕跳跃、探索和回家展开的像素平台游戏。用轻巧的移动穿过山谷，在夜色中找到属于自己的路。",
      tags: ["平台跳跃", "Godot", "像素风"],
    },
    {
      id: "forest",
      title: "森林来信",
      subtitle: "一场关于相遇与告别的温柔冒险。",
      type: "COZY EXPLORATION",
      status: "概念阶段",
      color: "forest",
      body: "捡起森林里遗落的信件，听听居民的故事。慢慢行走，慢慢发现，给一段记忆找到新的收件人。",
      tags: ["探索", "叙事", "治愈"],
    },
    {
      id: "stars",
      title: "星屿",
      subtitle: "拼起漂浮的岛屿，接住散落的星光。",
      type: "PUZZLE ADVENTURE",
      status: "原型设计",
      color: "stars",
      body: "旋转、连接漂浮在星空中的岛屿，让小路相遇。这是一个正在探索玩法边界的轻量解谜原型。",
      tags: ["解谜", "原型", "空间"],
    },
  ];
  function fresh() {
    return {
      posts: [],
      saved: [],
      liked: [],
      comments: {},
      date: "",
      streak: 0,
      exp: 0,
    };
  }
  function hydrate(raw) {
    const base = fresh();
    if (!raw || typeof raw !== "object") return base;
    base.posts = (Array.isArray(raw.posts) ? raw.posts : [])
      .filter(
        (p) =>
          p &&
          typeof p.id === "string" &&
          typeof p.title === "string" &&
          p.title.length <= 80 &&
          typeof p.body === "string" &&
          p.body.length <= 5000 &&
          categories.includes(p.category),
      )
      .map((p) => ({
        ...p,
        author: "你",
        likes: 0,
        comments: [],
        date: Number.isNaN(Date.parse(p.date))
          ? new Date().toISOString()
          : p.date,
      }));
    for (const key of ["saved", "liked"])
      base[key] = Array.isArray(raw[key])
        ? [...new Set(raw[key].filter((x) => typeof x === "string"))]
        : [];
    if (raw.comments && typeof raw.comments === "object")
      for (const [key, items] of Object.entries(raw.comments)) {
        if (["__proto__", "constructor", "prototype"].includes(key)) continue;
        if (Array.isArray(items))
          base.comments[key] = items
            .filter(
              (x) =>
                x &&
                typeof x.body === "string" &&
                x.body.trim() &&
                x.body.length <= 1000,
            )
            .map((x) => ({ author: "你", body: x.body }));
      }
    base.date =
      typeof raw.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(raw.date)
        ? raw.date
        : "";
    base.streak =
      Number.isSafeInteger(raw.streak) && raw.streak > 0 ? raw.streak : 0;
    base.exp = Number.isSafeInteger(raw.exp) && raw.exp >= 0 ? raw.exp : 0;
    return base;
  }
  function day(now = new Date()) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  }
  function checkin(state, now = new Date()) {
    const today = day(now);
    if (state.date === today) return false;
    const yesterday = day(new Date(now.getTime() - 86400000));
    state.streak = state.date === yesterday ? state.streak + 1 : 1;
    state.date = today;
    state.exp += 5 + (state.streak % 7 === 0 ? 5 : 0);
    return true;
  }
  function filter(items, state, category, query, sort) {
    const q = query.trim().toLocaleLowerCase();
    return items
      .filter(
        (p) =>
          (category === "全部" ||
            (category === "收藏"
              ? state.saved.includes(p.id)
              : p.category === category)) &&
          `${p.title} ${p.body} ${p.author}`.toLocaleLowerCase().includes(q),
      )
      .sort((a, b) =>
        sort === "hot"
          ? b.likes +
            Number(state.liked.includes(b.id)) -
            (a.likes + Number(state.liked.includes(a.id)))
          : Date.parse(b.date) - Date.parse(a.date),
      );
  }
  function escape(value) {
    return String(value).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  }
  root.RDModel = {
    categories,
    posts,
    works,
    fresh,
    hydrate,
    day,
    checkin,
    filter,
    escape,
  };
})(globalThis);
