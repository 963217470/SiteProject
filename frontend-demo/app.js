(function () {
  "use strict";
  const M = RDModel,
    $ = (s) => document.querySelector(s),
    key = "rd-studio-demo-v1";
  let state = M.fresh(),
    page = "home",
    category = "全部",
    query = "",
    sort = "latest",
    currentPost = null,
    toastTimer;
  try {
    state = M.hydrate(JSON.parse(localStorage.getItem(key)));
  } catch {
    /* Corrupt or disabled storage starts a usable in-memory session. */
  }
  const esc = M.escape;
  const icon = (name) => `<i data-lucide="${name}"></i>`;
  const icons = () => lucide.createIcons({ attrs: { "aria-hidden": "true" } });
  function toast(message) {
    $("#toast").textContent = message;
    $("#toast").classList.add("visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(
      () => $("#toast").classList.remove("visible"),
      3200,
    );
  }
  function save() {
    try {
      localStorage.setItem(key, JSON.stringify(state));
    } catch {
      toast("浏览器无法保存数据，本次操作仅在当前页面保留。");
      return false;
    }
    return true;
  }
  const allPosts = () => [...state.posts, ...M.posts];
  const commentsFor = (p) => [...p.comments, ...(state.comments[p.id] || [])];
  function dateLabel(date) {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "numeric",
      day: "numeric",
    }).format(new Date(date));
  }
  function postMarkup(p, i) {
    const liked = state.liked.includes(p.id),
      saved = state.saved.includes(p.id);
    return `<article class="post"><span class="post-avatar ${["mint", "lavender", "lemon"][i % 3]}">${esc(p.author.slice(0, 1))}</span><div class="post-body"><div class="post-meta"><b>${esc(p.author)}</b><span>${dateLabel(p.date)}</span><span class="tag">${esc(p.category)}</span></div><button class="post-title" data-post="${esc(p.id)}">${esc(p.title)}</button><p class="post-excerpt">${esc(p.body)}</p><div class="post-actions"><button data-like="${esc(p.id)}" aria-pressed="${liked}" class="${liked ? "selected" : ""}" aria-label="点赞 ${esc(p.title)}">${icon("heart")} ${p.likes + Number(liked)}</button><button data-post="${esc(p.id)}" aria-label="查看评论">${icon("message-circle")} ${commentsFor(p).length}</button><button data-save="${esc(p.id)}" aria-pressed="${saved}" class="${saved ? "selected" : ""}">${icon("bookmark")} ${saved ? "已收藏" : "收藏"}</button></div></div></article>`;
  }
  function renderPosts() {
    const results = M.filter(allPosts(), state, category, query, sort);
    $("#posts").innerHTML =
      results.map(postMarkup).join("") ||
      '<div class="empty"><h3>这里还安安静静的。</h3><p>换个关键词，或写下第一条帖子。</p><button class="text-button" data-reset>查看全部帖子</button></div>';
    $("#result-count").textContent =
      `${results.length} 条讨论 · 每一个想法，都值得被听见`;
    $("#post-count").textContent = String(allPosts().length).padStart(2, "0");
    document.querySelectorAll("[data-filter]").forEach((b) => {
      b.classList.toggle("active", b.dataset.filter === category);
      b.setAttribute("aria-pressed", b.dataset.filter === category);
    });
    $("#posts").style.animation = "none";
    void $("#posts").offsetWidth;
    $("#posts").style.animation = "";
    icons();
  }
  function renderWorks() {
    $("#works").innerHTML = M.works
      .map(
        (w) =>
          `<button class="work" data-work="${w.id}"><div class="cover"><canvas data-art="${w.color}" aria-label="${esc(w.title)}像素场景"></canvas><span class="cover-label">${w.type}</span><span class="cover-title">${w.title}<small>${w.type}</small></span></div><div class="work-info"><span><b>${w.title}</b><small>${w.subtitle}</small></span><em>${w.status} ${icon("arrow-up-right")}</em></div></button>`,
      )
      .join("");
    paint();
    icons();
  }
  function paint() {
    document
      .querySelectorAll("canvas[data-art]")
      .forEach((c) => RDArt(c, c.dataset.art));
  }
  function open(content) {
    currentPost = null;
    $("#detail-content").innerHTML = content;
    icons();
    paint();
    $("#detail").showModal();
  }
  function detailPost(id) {
    const p = allPosts().find((p) => p.id === id);
    if (!p) return;
    const comments = commentsFor(p);
    const content = `<span class="tag">${p.category}</span><h2 class="detail-title">${esc(p.title)}</h2><div class="post-meta">${esc(p.author)} · ${dateLabel(p.date)}</div><div class="detail-body">${esc(p.body)}</div><div class="post-actions"><button data-like="${esc(p.id)}" aria-pressed="${state.liked.includes(p.id)}" class="${state.liked.includes(p.id) ? "selected" : ""}">${icon("heart")} ${p.likes + Number(state.liked.includes(p.id))}</button><button data-save="${esc(p.id)}" aria-pressed="${state.saved.includes(p.id)}" class="${state.saved.includes(p.id) ? "selected" : ""}">${icon("bookmark")} ${state.saved.includes(p.id) ? "已收藏" : "收藏"}</button></div><section class="comments"><h3>一起聊聊 · ${comments.length}</h3>${comments.map((c) => `<div class="comment"><strong>${esc(c.author)}</strong>${esc(c.body).replace(/\n/g, "<br>")}</div>`).join("") || '<p class="subtle">还没有回复，来分享你的想法。</p>'}<form class="comment-form" id="comment-form"><label for="comment-body">你的回复</label><textarea id="comment-body" required maxlength="1000" rows="3" placeholder="友善交流，让想法继续生长。"></textarea><button class="primary" type="submit">发布回复 ${icon("arrow-up-right")}</button></form></section>`;
    if ($("#detail").open) {
      $("#detail-content").innerHTML = content;
      icons();
    } else open(content);
    currentPost = id;
  }
  function switchPage(next, scroll = true) {
    if (!["home", "games", "community", "knowledge", "about"].includes(next))
      next = "home";
    page = next;
    currentPost = null;
    const home = page === "home";
    $("#hero").hidden = !home;
    $("#entries").hidden = !home;
    $("#showcase").hidden = !(home || page === "games");
    $("#community").hidden = !(home || page === "community");
    $("#extra").hidden = !["knowledge", "about", "games"].includes(page);
    document.querySelectorAll("nav [data-page]").forEach((b) => {
      b.classList.toggle("active", b.dataset.page === page);
      if (b.dataset.page === page) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    });
    $("nav").classList.remove("open");
    $("#menu").setAttribute("aria-expanded", "false");
    if (page === "knowledge") {
      $("#extra").innerHTML =
        `<div class="section-heading"><div><div class="eyebrow muted">A LITTLE MORE KNOW-HOW</div><h2>把经验，留给下一个创作者。</h2><p class="subtle">从第一行代码，到第一个完整的世界。</p></div></div><div class="knowledge-grid">${notes.map((n, i) => `<button class="note" data-note="${i}"><span class="tag ${["mint", "lavender", "lemon"][i % 3]}">${n.category}</span><h3>${n.title}</h3><p>${n.summary}</p></button>`).join("")}</div>`;
    } else if (page === "games") {
      $("#extra").innerHTML =
        `<div class="section-heading"><div><div class="eyebrow muted">FOR YOUR NEXT IDEA</div><h2>让创作轻一点的小工具</h2></div></div><div class="knowledge-grid">${tools.map((t, i) => `<button class="note" data-tool="${i}"><span class="tag mint">${t.type}</span><h3>${t.title}</h3><p>${t.summary}</p></button>`).join("")}</div>`;
    } else if (page === "about") {
      $("#extra").innerHTML =
        '<div class="about-band"><div class="eyebrow muted">MEET THE MAKERS</div><h2>RD STUDIO</h2><p>我们是一个因游戏创作而相遇的社团。有人写代码，有人画世界，有人设计规则。我们相信，作品可以从一个很小的点子开始，而每个人都能找到自己的位置。</p><div class="role-list"><span class="mint">程序</span><span class="lavender">美术</span><span class="lemon">策划</span><span class="mint">技术美术</span><span class="lavender">音效</span><span class="lemon">运营</span></div></div><div class="about-band"><h3>在这里，一起创造、学习、分享。</h3><p>带着你的点子或作品，在社区发起讨论，也可以寻找下一个 Game Jam 的伙伴。</p><button class="primary" data-category="组队招募">寻找创作伙伴</button></div>';
    }
    $("#main").classList.remove("page-enter");
    void $("#main").offsetWidth;
    $("#main").classList.add("page-enter");
    icons();
    if (location.hash !== `#${next}`)
      history.replaceState(null, "", `#${next}`);
    if (scroll)
      window.scrollTo({
        top: 0,
        behavior: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
  }
  const notes = [
    {
      title: "Godot：让第一次跳跃更自然",
      category: "程序",
      summary: "土狼时间、跳跃缓冲与手感调试。",
      body: "土狼时间\n角色刚离开平台时，保留一小段起跳窗口。通常可以从 0.1 秒开始调试。\n\n跳跃缓冲\n玩家落地前按下跳跃键时，短暂记录输入，落地后执行起跳。\n\n调试顺序\n先确定最大高度和到达顶点的时间，再调整下落速度。每次只改一个参数，保留一个能快速反复测试的小场景。",
    },
    {
      title: "16 色：像素世界的第一块砖",
      category: "美术",
      summary: "用有限颜色构建清晰的形体。",
      body: "先用三种灰度画出形体，确认轮廓和明暗，再加入颜色。\n\n同一个物体的颜色不必只改变亮度，阴影可以向冷色偏移，高光可以加入暖色。\n\n在原始尺寸与放大尺寸间反复检查，避免细节吞掉整体轮廓。",
    },
    {
      title: "48 小时：把 Game Jam 做完",
      category: "策划",
      summary: "控制范围，给完成留出时间。",
      body: "前 4 小时：确定一个核心动作，完成最简原型。\n\n第一个夜晚：让游戏从开始到结束可以完整游玩。\n\n第二天：加入美术、声音和反馈，保留至少 6 小时测试、打包与提交。\n\n完成一个小而完整的体验，比堆叠没有调好的系统更重要。",
    },
    {
      title: "第一份关卡反馈怎么写",
      category: "设计",
      summary: "描述发生了什么，再讨论为什么。",
      body: "先记录观察：玩家在哪里停顿、在哪一步误解规则。\n\n区分事实与猜测：不要把个人喜好直接当成问题。\n\n每次选择一个值得验证的改动，然后邀请新的玩家测试。",
    },
    {
      title: "小团队的版本管理约定",
      category: "协作",
      summary: "减少覆盖，让迭代有迹可循。",
      body: "约定目录、命名方式和提交频率。\n\n资源修改前先告诉负责同一文件的伙伴。把大型二进制资源与源码分开管理，必要时使用 Git LFS。\n\n每次交付前，从干净环境运行一遍，记录版本号和已知问题。",
    },
    {
      title: "声音：给世界留一点空气",
      category: "音效",
      summary: "环境层次、动态变化与有意的留白。",
      body: "持续背景层与偶发声音分别处理。\n\n给远处声音较小的音量，降低高频，让空间更有层次。\n\n不要让所有声音同时占据注意力。在关键动作之前留白，反馈会更加清晰。",
    },
  ];
  const tools = [
    {
      title: "48h Game Jam 规划模板",
      type: "Markdown 模板",
      summary: "从核心玩法到提交检查，留住最重要的步骤。",
      file: "game-jam-plan.md",
      body: "# Game Jam 规划\n\n## 核心想法\n- 一句话玩法：\n- 最小完成范围：\n- 团队分工：\n\n## 时间安排\n- [ ] 0-4h：核心原型\n- [ ] 4-24h：完整流程\n- [ ] 24-36h：美术与音效\n- [ ] 36-42h：测试与修复\n- [ ] 42-48h：打包与提交\n\n## 提交检查\n- [ ] 新环境能够运行\n- [ ] 操作说明\n- [ ] 作品截图\n- [ ] 素材来源与许可\n",
    },
    {
      title: "试玩反馈记录表",
      type: "Markdown 模板",
      summary: "记录真实观察，让下一次迭代有据可循。",
      file: "playtest.md",
      body: "# 试玩反馈\n\n## 基本信息\n- 游戏版本：\n- 测试日期：\n- 设备与系统：\n\n## 观察\n- 玩家做了什么：\n- 在哪里停顿：\n- 意外发生了什么：\n\n## 问题与猜测\n- 具体问题：\n- 可能原因：\n- 需要验证的改动：\n\n## 下一步\n- [ ] 优先改动\n- [ ] 再次测试\n",
    },
    {
      title: "RD 创作调色板",
      type: "CSS 变量",
      summary: "暖白、红色、淡黄、淡紫与薄荷绿。",
      file: "rd-palette.css",
      body: ":root {\n  --paper: #fafaf5;\n  --ink: #292f2b;\n  --red: #e64b3c;\n  --yellow: #faf1ba;\n  --purple: #e9e2fa;\n  --mint: #dceee2;\n}\n",
    },
  ];
  function checkinView() {
    open(
      `<div class="streak"><span class="tag">每日签到</span><b>${state.streak}</b><p>已连续签到 ${state.streak} 天</p><small>今日签到 +5 EXP · 每连续 7 天额外 +5 EXP</small><p class="subtle">累计经验 ${state.exp} EXP</p><button class="primary" id="checkin" ${state.date === M.day() ? "disabled" : ""}>${state.date === M.day() ? "今天已签到" : "签到，开启今天的创作"}</button></div>`,
    );
  }
  function showProfile() {
    open(
      `<h2>你好，创作者。</h2><div class="profile-stats"><span><b>${state.posts.length}</b>我的发布</span><span><b>${state.saved.length}</b>我的收藏</span><span><b>${state.exp}</b>累计经验</span></div><div class="role-list"><button class="secondary" data-profile-saved>查看收藏</button><button class="primary" id="profile-daily">每日签到</button></div><p class="subtle">这是一份本地示例资料，无需注册。</p>`,
    );
  }
  function toggle(key, id) {
    if (!allPosts().some((p) => p.id === id)) return;
    const index = state[key].indexOf(id);
    if (index < 0) state[key].push(id);
    else state[key].splice(index, 1);
    save();
    renderPosts();
    if (currentPost) detailPost(currentPost);
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("button,a[data-page]");
    if (!b) return;
    if (b.hasAttribute("data-close")) b.closest("dialog").close();
    else if (b.dataset.page) switchPage(b.dataset.page);
    else if (b.hasAttribute("data-compose")) {
      $("#post-form").reset();
      $("#compose").showModal();
    } else if (b.dataset.filter) {
      category = b.dataset.filter;
      renderPosts();
    } else if (b.dataset.category) {
      category = b.dataset.category;
      query = "";
      $("#query").value = "";
      switchPage("community");
      renderPosts();
    } else if (b.dataset.post) detailPost(b.dataset.post);
    else if (b.dataset.like) toggle("liked", b.dataset.like);
    else if (b.dataset.save) toggle("saved", b.dataset.save);
    else if (b.dataset.work) {
      const w = M.works.find((w) => w.id === b.dataset.work);
      open(
        `<div class="detail-cover"><canvas data-art="${w.color}" aria-label="${w.title}封面"></canvas></div><h2 class="detail-title">${w.title}</h2><span class="tag">${w.status}</span><div class="detail-body">${w.body}</div><div class="role-list">${w.tags.map((t) => `<span class="mint">${t}</span>`).join("")}</div><p class="subtle">这是作品展示示例，暂无可下载的游戏文件。</p><button class="primary" data-work-discuss>去社区聊聊</button>`,
      );
    } else if (b.hasAttribute("data-work-discuss")) {
      $("#detail").close();
      category = "作品试玩";
      switchPage("community");
      renderPosts();
    } else if (b.dataset.query) {
      query = b.dataset.query;
      category = "全部";
      switchPage("community");
      $(".search-row").hidden = false;
      $("#query").value = query;
      renderPosts();
    } else if (b.dataset.note !== undefined) {
      const n = notes[Number(b.dataset.note)];
      open(
        `<span class="tag">${n.category}</span><h2 class="detail-title">${n.title}</h2><div class="detail-body">${n.body}</div>`,
      );
    } else if (b.dataset.tool !== undefined) {
      const t = tools[Number(b.dataset.tool)];
      open(
        `<span class="tag mint">${t.type}</span><h2 class="detail-title">${t.title}</h2><div class="detail-body">${esc(t.body)}</div><button class="primary" data-download-tool="${b.dataset.tool}">${icon("download")} 下载源文件</button>`,
      );
    } else if (b.dataset.downloadTool !== undefined) {
      const t = tools[Number(b.dataset.downloadTool)];
      const url = URL.createObjectURL(
        new Blob([t.body], { type: "text/plain;charset=utf-8" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = t.file;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast("源文件已准备下载。");
    } else if (b.hasAttribute("data-reset")) {
      category = "全部";
      query = "";
      $("#query").value = "";
      renderPosts();
    } else if (b.hasAttribute("data-profile-saved")) {
      $("#detail").close();
      category = "收藏";
      switchPage("community");
      renderPosts();
    } else if (b.id === "search-button") {
      switchPage("community");
      $(".search-row").hidden = false;
      $("#query").focus();
    } else if (b.id === "clear-search") {
      query = "";
      $("#query").value = "";
      $(".search-row").hidden = true;
      renderPosts();
      $("#search-button").focus();
    } else if (b.id === "profile") showProfile();
    else if (["daily-button", "checkin-side", "profile-daily"].includes(b.id)) {
      if ($("#detail").open) $("#detail").close();
      checkinView();
    } else if (b.id === "checkin") {
      if (M.checkin(state)) {
        const persisted = save();
        $("#detail").close();
        checkinView();
        if (persisted)
          toast(
            state.streak % 7 === 0
              ? "连续 7 天签到，获得 10 EXP！"
              : "签到成功，获得 5 EXP！",
          );
      }
    } else if (b.id === "menu") {
      const shown = $("nav").classList.toggle("open");
      b.setAttribute("aria-expanded", shown);
    } else if (b.id === "welcome")
      open(
        '<h2 class="detail-title">欢迎来到 RD STUDIO。</h2><div class="detail-body">在这里分享作品，记录开发，也寻找一起创造的伙伴。\n\n友善讨论，尊重原创。提问时附上背景和已尝试的方法，反馈时描述具体体验。\n\n你看到的是纯前端示例社区。帖子、回复、收藏与签到保存在当前浏览器，不会发到线上社团。</div>',
      );
  });
  $("#query").addEventListener("input", (e) => {
    query = e.target.value;
    renderPosts();
  });
  $("#sort").addEventListener("change", (e) => {
    sort = e.target.value;
    renderPosts();
  });
  $("#post-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const form = new FormData(e.target),
      title = form.get("title").trim(),
      body = form.get("body").trim();
    if (!title || !body) return toast("标题和正文不能只包含空格。");
    state.posts.unshift({
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title,
      body,
      category: form.get("category"),
      author: "你",
      date: new Date().toISOString(),
      likes: 0,
      comments: [],
    });
    const persisted = save();
    $("#compose").close();
    category = "全部";
    query = "";
    $("#query").value = "";
    sort = "latest";
    $("#sort").value = sort;
    switchPage("community");
    renderPosts();
    if (persisted) toast("帖子已发布到本地社区。");
  });
  $("#detail-content").addEventListener("submit", (e) => {
    if (e.target.id !== "comment-form") return;
    e.preventDefault();
    const body = $("#comment-body").value.trim();
    if (!body) return toast("写点内容再发布吧。");
    if (!currentPost) return;
    (state.comments[currentPost] ||= []).push({ author: "你", body });
    const persisted = save();
    detailPost(currentPost);
    renderPosts();
    $("#comment-body").focus();
    if (persisted) toast("回复已发布。");
  });
  document.querySelectorAll("dialog").forEach((d) =>
    d.addEventListener("click", (e) => {
      if (e.target !== d) return;
      const r = d.getBoundingClientRect();
      if (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      )
        d.close();
    }),
  );
  window.addEventListener("hashchange", () =>
    switchPage(location.hash.slice(1), false),
  );
  renderWorks();
  renderPosts();
  switchPage(location.hash.slice(1) || "home", false);
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches) {
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("revealed");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.12 },
    );
    document.querySelectorAll(".work,.post").forEach((el, i) => {
      el.style.setProperty("--delay", `${(i % 3) * 65}ms`);
      el.classList.add("reveal-ready");
      observer.observe(el);
    });
  }
})();
