import{c as n,S as a,j as p,m as i}from"./chunks/framework.DT_SM_aS.js";const o=JSON.parse('{"title":"八、前端页面设计","description":"","frontmatter":{},"headers":[],"relativePath":"08-前端页面设计.md","filePath":"08-前端页面设计.md"}'),l={name:"08-前端页面设计.md"};function e(t,s,c,h,d,r){return a(),p("div",null,[...s[0]||(s[0]=[i(`<h1 id="八、前端页面设计" tabindex="-1">八、前端页面设计 <a class="header-anchor" href="#八、前端页面设计" aria-label="Permalink to &quot;八、前端页面设计&quot;">​</a></h1><h2 id="_8-1-页面总览" tabindex="-1">8.1 页面总览 <a class="header-anchor" href="#_8-1-页面总览" aria-label="Permalink to &quot;8.1 页面总览&quot;">​</a></h2><table tabindex="0"><thead><tr><th>页面</th><th>路由</th><th>说明</th><th>访问权限</th></tr></thead><tbody><tr><td>首页</td><td><code>/</code></td><td>门户页面</td><td>游客可访问</td></tr><tr><td>文章列表</td><td><code>/articles</code></td><td>所有文章</td><td>游客可访问</td></tr><tr><td>文章详情</td><td><code>/articles/:id</code></td><td>阅读文章</td><td>游客可访问（内部文章需登录）</td></tr><tr><td>内部文章</td><td><code>/internal</code></td><td>内部文章</td><td>社员/管理员</td></tr><tr><td>作品展示</td><td><code>/works</code></td><td>社团作品</td><td>游客可访问</td></tr><tr><td>关于我们</td><td><code>/about</code></td><td>社团介绍</td><td>游客可访问</td></tr><tr><td>登录</td><td><code>/login</code></td><td>GitHub 登录</td><td>游客</td></tr><tr><td>邀请加入</td><td><code>/invite/:code</code></td><td>通过邀请链接加入</td><td>游客</td></tr><tr><td><strong>用户主页</strong></td><td><code>/user/:id</code></td><td>用户个人主页</td><td>游客可访问</td></tr><tr><td><strong>个人设置</strong></td><td><code>/user/settings</code></td><td>编辑个人资料</td><td>已登录用户</td></tr><tr><td>后台管理</td><td><code>/admin</code></td><td>管理后台</td><td>管理员</td></tr><tr><td>编辑文章</td><td><code>/admin/editor/:id?</code></td><td>编辑/新建文章</td><td>社员/管理员</td></tr><tr><td>审核队列</td><td><code>/admin/review</code></td><td>待审核文章</td><td>管理员</td></tr><tr><td>用户管理</td><td><code>/admin/users</code></td><td>管理用户</td><td>管理员</td></tr></tbody></table><h2 id="_8-2-页面跳转逻辑" tabindex="-1">8.2 页面跳转逻辑 <a class="header-anchor" href="#_8-2-页面跳转逻辑" aria-label="Permalink to &quot;8.2 页面跳转逻辑&quot;">​</a></h2><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>┌─────────────────────────────────────────────────────────────┐</span></span>
<span class="line"><span>│                        页面跳转流程                          │</span></span>
<span class="line"><span>└─────────────────────────────────────────────────────────────┘</span></span>
<span class="line"><span></span></span>
<span class="line"><span>游客访问网站</span></span>
<span class="line"><span>      │</span></span>
<span class="line"><span>      ▼</span></span>
<span class="line"><span>┌─────────────┐</span></span>
<span class="line"><span>│    首页     │ ← 默认落地页</span></span>
<span class="line"><span>└──────┬──────┘</span></span>
<span class="line"><span>       │</span></span>
<span class="line"><span>       ├──→ [文章列表] ──→ [文章详情]</span></span>
<span class="line"><span>       │</span></span>
<span class="line"><span>       ├──→ [作品展示]</span></span>
<span class="line"><span>       │</span></span>
<span class="line"><span>       ├──→ [关于我们]</span></span>
<span class="line"><span>       │</span></span>
<span class="line"><span>       ├──→ [用户主页] ──→ 查看用户文章</span></span>
<span class="line"><span>       │</span></span>
<span class="line"><span>       └──→ [登录] ──→ GitHub OAuth ──→ 返回原页面</span></span>
<span class="line"><span>                │</span></span>
<span class="line"><span>                ▼</span></span>
<span class="line"><span>         ┌─────────────┐</span></span>
<span class="line"><span>         │  已登录用户  │</span></span>
<span class="line"><span>         └──────┬──────┘</span></span>
<span class="line"><span>                │</span></span>
<span class="line"><span>                ├──→ [个人设置] ──→ 修改头像/昵称/简介（需审核）</span></span>
<span class="line"><span>                │</span></span>
<span class="line"><span>                ├──→ [我的文章] ──→ 草稿/已发布/退回 分栏</span></span>
<span class="line"><span>                │</span></span>
<span class="line"><span>                ├──→ [内部文章]</span></span>
<span class="line"><span>                │</span></span>
<span class="line"><span>                ├──→ [点赞/评论]</span></span>
<span class="line"><span>                │</span></span>
<span class="line"><span>                └──→ [管理后台] (仅管理员)</span></span>
<span class="line"><span>                        │</span></span>
<span class="line"><span>                        ├──→ [文章管理]</span></span>
<span class="line"><span>                        ├──→ [编辑文章]</span></span>
<span class="line"><span>                        ├──→ [审核队列]</span></span>
<span class="line"><span>                        └──→ [用户管理]</span></span></code></pre></div><h2 id="_8-3-各页面设计" tabindex="-1">8.3 各页面设计 <a class="header-anchor" href="#_8-3-各页面设计" aria-label="Permalink to &quot;8.3 各页面设计&quot;">​</a></h2><h3 id="_8-3-1-首页" tabindex="-1">8.3.1 首页 <code>/</code> <a class="header-anchor" href="#_8-3-1-首页" aria-label="Permalink to &quot;8.3.1 首页 \`/\`&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>┌─────────────────────────────────────────────────────────────┐</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  🖼️ 随机背景大图（游戏相关图片，每次刷新不同）               │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│                    🎮 游戏开发社团                           │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│              创造 · 学习 · 分享                               │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│          [GitHub] [QQ群] [邮箱]                              │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│                      [了解更多]                              │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>├─────────────────────────────────────────────────────────────┤</span></span>
<span class="line"><span>│  LOGO    首页  文章  内部  关于      🔍 搜索    [登录]       │</span></span>
<span class="line"><span>├─────────────────────────────────────────────────────────────┤</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  📝 最新文章                                                │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  ┌─────────────────────────────────────────────────────┐   │</span></span>
<span class="line"><span>│  │  🖼️ ┌────────────────────────────────────────────┐  │   │</span></span>
<span class="line"><span>│  │     │  Unity 2D 光照系统入门指南                  │  │   │</span></span>
<span class="line"><span>│  │     │                                            │  │   │</span></span>
<span class="line"><span>│  │     │  在 Unity 2021+ 中，我们可以使用 URP 来    │  │   │</span></span>
<span class="line"><span>│  │     │  实现精美的 2D 光照效果...                  │  │   │</span></span>
<span class="line"><span>│  │     │                                            │  │   │</span></span>
<span class="line"><span>│  │     │  张三 · 2024-01-15 · ❤️ 128 · 💬 23      │  │   │</span></span>
<span class="line"><span>│  │     └────────────────────────────────────────────┘  │   │</span></span>
<span class="line"><span>│  └─────────────────────────────────────────────────────┘   │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  ┌─────────────────────────────────────────────────────┐   │</span></span>
<span class="line"><span>│  │  🖼️ ┌────────────────────────────────────────────┐  │   │</span></span>
<span class="line"><span>│  │     │  Godot 4.0 入门教程                        │  │   │</span></span>
<span class="line"><span>│  │     │                                            │  │   │</span></span>
<span class="line"><span>│  │     │  Godot 是一款开源的游戏引擎，适合初学者...  │  │   │</span></span>
<span class="line"><span>│  │     │                                            │  │   │</span></span>
<span class="line"><span>│  │     │  李四 · 2024-01-10 · ❤️ 89 · 💬 15       │  │   │</span></span>
<span class="line"><span>│  │     └────────────────────────────────────────────┘  │   │</span></span>
<span class="line"><span>│  └─────────────────────────────────────────────────────┘   │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│                        [查看更多文章 →]                       │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>├─────────────────────────────────────────────────────────────┤</span></span>
<span class="line"><span>│  Footer: GitHub | 联系方式 | 版权信息                        │</span></span>
<span class="line"><span>└─────────────────────────────────────────────────────────────┘</span></span></code></pre></div><p><strong>跳转逻辑</strong>：</p><ul><li>点击文章卡片 → <code>/articles/:id</code></li><li>点击「查看更多文章」→ <code>/articles</code></li><li>点击社交链接 → 对应平台</li><li>点击「登录」→ <code>/login</code></li></ul><hr><h3 id="_8-3-2-文章列表-articles" tabindex="-1">8.3.2 文章列表 <code>/articles</code> <a class="header-anchor" href="#_8-3-2-文章列表-articles" aria-label="Permalink to &quot;8.3.2 文章列表 \`/articles\`&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>┌─────────────────────────────────────────────────────────────┐</span></span>
<span class="line"><span>│  LOGO    首页  文章  内部  关于      🔍 搜索    [登录]       │</span></span>
<span class="line"><span>├─────────────────────────────────────────────────────────────┤</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  📝 文章列表                                                │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  标签筛选：                                                  │</span></span>
<span class="line"><span>│  [Unity] [Godot] [Unreal] [教程] [入门] [进阶] [+ 更多]     │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  排序：[最新 ▼] [最早] [点赞最多]                            │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>├─────────────────────────────────────────────────────────────┤</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  ┌─────────────────────────────────────────────────────┐   │</span></span>
<span class="line"><span>│  │  🖼️ ┌────────────────────────────────────────────┐  │   │</span></span>
<span class="line"><span>│  │     │  Unity 2D 光照系统入门指南                  │  │   │</span></span>
<span class="line"><span>│  │     │                                            │  │   │</span></span>
<span class="line"><span>│  │     │  在 Unity 2021+ 中，我们可以使用 URP 来    │  │   │</span></span>
<span class="line"><span>│  │     │  实现精美的 2D 光照效果...                  │  │   │</span></span>
<span class="line"><span>│  │     │                                            │  │   │</span></span>
<span class="line"><span>│  │     │  🔖 Unity 2D游戏 教程 进阶                 │  │   │</span></span>
<span class="line"><span>│  │     │  张三 · 2024-01-15 · ❤️ 128 · 💬 23      │  │   │</span></span>
<span class="line"><span>│  │     └────────────────────────────────────────────┘  │   │</span></span>
<span class="line"><span>│  └─────────────────────────────────────────────────────┘   │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  ┌─────────────────────────────────────────────────────┐   │</span></span>
<span class="line"><span>│  │  🖼️ ┌────────────────────────────────────────────┐  │   │</span></span>
<span class="line"><span>│  │     │  Godot 4.0 入门教程                        │  │   │</span></span>
<span class="line"><span>│  │     │                                            │  │   │</span></span>
<span class="line"><span>│  │     │  Godot 是一款开源的游戏引擎，适合初学者...  │  │   │</span></span>
<span class="line"><span>│  │     │                                            │  │   │</span></span>
<span class="line"><span>│  │     │  🔖 Godot 入门                             │  │   │</span></span>
<span class="line"><span>│  │     │  李四 · 2024-01-10 · ❤️ 89 · 💬 15       │  │   │</span></span>
<span class="line"><span>│  │     └────────────────────────────────────────────┘  │   │</span></span>
<span class="line"><span>│  └─────────────────────────────────────────────────────┘   │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  分页：&lt; 1 2 3 ... 10 &gt;                                     │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>└─────────────────────────────────────────────────────────────┘</span></span></code></pre></div><p><strong>跳转逻辑</strong>：</p><ul><li>点击文章 → <code>/articles/:id</code></li><li>点击标签 → 筛选该标签的文章</li><li>点击排序 → 切换排序方式</li><li>点击分页 → 加载对应页</li></ul><hr><h3 id="_8-3-3-文章详情-articles-id" tabindex="-1">8.3.3 文章详情 <code>/articles/:id</code> <a class="header-anchor" href="#_8-3-3-文章详情-articles-id" aria-label="Permalink to &quot;8.3.3 文章详情 \`/articles/:id\`&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>┌─────────────────────────────────────────────────────────────┐</span></span>
<span class="line"><span>│  LOGO    首页  文章  作品  关于      🔍 搜索    [登录]       │</span></span>
<span class="line"><span>├─────────────────────────────────────────────────────────────┤</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  ← 返回列表                                                 │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  Unity 2D 光照系统入门指南                                   │</span></span>
<span class="line"><span>│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  张三 · 2024-01-15 · 🔖 Unity 2D游戏 教程                   │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>├─────────────────────────────────────────────────────────────┤</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  ## 前言                                                    │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  在 Unity 2021+ 中，我们可以使用 URP 来实现精美的 2D 光照... │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  ## 环境准备                                                │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  首先需要安装以下依赖：                                      │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  \`\`\`csharp                                                  │</span></span>
<span class="line"><span>│  // 示例代码                                                │</span></span>
<span class="line"><span>│  public Light2D light;                                      │</span></span>
<span class="line"><span>│  \`\`\`                                                        │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  [图片]                                                     │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>├─────────────────────────────────────────────────────────────┤</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  ❤️ 128  💬 23  [分享]                                      │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>├─────────────────────────────────────────────────────────────┤</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  💬 评论区                                                  │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  ┌─────────────────────────────────────────────────────┐   │</span></span>
<span class="line"><span>│  │  用户A · 2小时前                                     │   │</span></span>
<span class="line"><span>│  │  写得很好，学到了！                                   │   │</span></span>
<span class="line"><span>│  └─────────────────────────────────────────────────────┘   │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  ┌─────────────────────────────────────────────────────┐   │</span></span>
<span class="line"><span>│  │  用户B · 1小时前                                     │   │</span></span>
<span class="line"><span>│  │  请问代码示例在哪里下载？                             │   │</span></span>
<span class="line"><span>│  └─────────────────────────────────────────────────────┘   │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  [登录后可评论]                                              │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>└─────────────────────────────────────────────────────────────┘</span></span></code></pre></div><p><strong>跳转逻辑</strong>：</p><ul><li>点击「返回列表」→ <code>/articles</code></li><li>点击标签 → <code>/articles?tag=xxx</code></li><li>点击作者名 → 作者主页（暂不实现）</li><li>未登录点击评论区 → <code>/login</code></li></ul><hr><h3 id="_8-3-4-内部文章-internal" tabindex="-1">8.3.4 内部文章 <code>/internal</code> <a class="header-anchor" href="#_8-3-4-内部文章-internal" aria-label="Permalink to &quot;8.3.4 内部文章 \`/internal\`&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>┌─────────────────────────────────────────────────────────────┐</span></span>
<span class="line"><span>│  LOGO    首页  文章  作品  关于      🔍 搜索    👤 张三 [退出] │</span></span>
<span class="line"><span>├─────────────────────────────────────────────────────────────┤</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  🔒 内部文章（仅社员可见）                                   │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  标签筛选：                                                  │</span></span>
<span class="line"><span>│  [Unity] [Godot] [Unreal] [教程] [+ 更多]                   │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>├─────────────────────────────────────────────────────────────┤</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  ┌─────────────────────────────────────────────────────┐   │</span></span>
<span class="line"><span>│  │  🔒 Unreal 引擎学习笔记                              │   │</span></span>
<span class="line"><span>│  │     王五 · 2024-01-08                               │   │</span></span>
<span class="line"><span>│  │     🔖 Unreal Engine 进阶                           │   │</span></span>
<span class="line"><span>│  └─────────────────────────────────────────────────────┘   │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  ┌─────────────────────────────────────────────────────┐   │</span></span>
<span class="line"><span>│  │  🔒 会议记录 0105                                    │   │</span></span>
<span class="line"><span>│  │     管理员 · 2024-01-05                             │   │</span></span>
<span class="line"><span>│  │     🔖 会议记录                                     │   │</span></span>
<span class="line"><span>│  └─────────────────────────────────────────────────────┘   │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>└─────────────────────────────────────────────────────────────┘</span></span></code></pre></div><p><strong>跳转逻辑</strong>：</p><ul><li>未登录访问 → 重定向到 <code>/login</code></li><li>社员/管理员可访问</li><li>点击文章 → <code>/internal/:id</code></li></ul><hr><h3 id="_8-3-5-登录-login" tabindex="-1">8.3.5 登录 <code>/login</code> <a class="header-anchor" href="#_8-3-5-登录-login" aria-label="Permalink to &quot;8.3.5 登录 \`/login\`&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>┌─────────────────────────────────────────────────────────────┐</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│                     🎮 游戏开发社团                          │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│                   使用 GitHub 账号登录                       │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│              ┌─────────────────────────────┐                │</span></span>
<span class="line"><span>│              │     🔑 使用 GitHub 登录     │                │</span></span>
<span class="line"><span>│              └─────────────────────────────┘                │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│                     还没有账号？                             │</span></span>
<span class="line"><span>│            登录后自动创建账号并成为社员                       │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>└─────────────────────────────────────────────────────────────┘</span></span></code></pre></div><p><strong>跳转逻辑</strong>：</p><ul><li>点击「使用 GitHub 登录」→ GitHub OAuth → 返回来源页面</li><li>通过邀请链接进入 → 登录后自动加入社团</li></ul><hr><h3 id="_8-3-6-邀请加入-invite-code" tabindex="-1">8.3.6 邀请加入 <code>/invite/:code</code> <a class="header-anchor" href="#_8-3-6-邀请加入-invite-code" aria-label="Permalink to &quot;8.3.6 邀请加入 \`/invite/:code\`&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>┌─────────────────────────────────────────────────────────────┐</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│                     🎮 游戏开发社团                          │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│              ┌─────────────────────────────┐                │</span></span>
<span class="line"><span>│              │                             │                │</span></span>
<span class="line"><span>│              │   您已登录：张三             │                │</span></span>
<span class="line"><span>│              │                             │                │</span></span>
<span class="line"><span>│              │   点击确认加入社团           │                │</span></span>
<span class="line"><span>│              │   将获得社员权限             │                │</span></span>
<span class="line"><span>│              │                             │                │</span></span>
<span class="line"><span>│              │     [ 确认加入 ]            │                │</span></span>
<span class="line"><span>│              │                             │                │</span></span>
<span class="line"><span>│              └─────────────────────────────┘                │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>└─────────────────────────────────────────────────────────────┘</span></span>
<span class="line"><span></span></span>
<span class="line"><span>未登录状态：</span></span>
<span class="line"><span></span></span>
<span class="line"><span>┌─────────────────────────────────────────────────────────────┐</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│                     🎮 游戏开发社团                          │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│              ┌─────────────────────────────┐                │</span></span>
<span class="line"><span>│              │     🔑 使用 GitHub 登录     │                │</span></span>
<span class="line"><span>│              └─────────────────────────────┘                │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│                   登录后自动加入社团                         │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>└─────────────────────────────────────────────────────────────┘</span></span></code></pre></div><p><strong>跳转逻辑</strong>：</p><ul><li>已登录 → 显示确认界面 → 点击确认 → 加入成功 → 跳转到 <code>/</code></li><li>未登录 → 显示登录界面 → 登录后自动加入 → 跳转到 <code>/</code></li><li>链接无效/已使用 → 显示错误提示</li></ul><hr><h3 id="_8-3-7-用户主页-user-id" tabindex="-1">8.3.7 用户主页 <code>/user/:id</code> <a class="header-anchor" href="#_8-3-7-用户主页-user-id" aria-label="Permalink to &quot;8.3.7 用户主页 \`/user/:id\`&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>┌─────────────────────────────────────────────────────────────┐</span></span>
<span class="line"><span>│  LOGO    首页  文章  作品  关于      🔍 搜索    👤 张三 [退出] │</span></span>
<span class="line"><span>├─────────────────────────────────────────────────────────────┤</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  ┌─────────────────────────────────────────────────────┐   │</span></span>
<span class="line"><span>│  │                                                     │   │</span></span>
<span class="line"><span>│  │      ┌─────────┐                                    │   │</span></span>
<span class="line"><span>│  │      │  头像   │   张三                              │   │</span></span>
<span class="line"><span>│  │      │         │   这是个人简介...                   │   │</span></span>
<span class="line"><span>│  │      └─────────┘                                    │   │</span></span>
<span class="line"><span>│  │                                                     │   │</span></span>
<span class="line"><span>│  │      文章 12 · 点赞 256 · 评论 89                   │   │</span></span>
<span class="line"><span>│  │                                                     │   │</span></span>
<span class="line"><span>│  └─────────────────────────────────────────────────────┘   │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  📝 TA 的文章                                               │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  ┌─────────────────────────────────────────────────────┐   │</span></span>
<span class="line"><span>│  │  📝 Unity 2D 光照系统入门指南                         │   │</span></span>
<span class="line"><span>│  │     2024-01-15 · ❤️ 128 · 💬 23                    │   │</span></span>
<span class="line"><span>│  └─────────────────────────────────────────────────────┘   │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  ┌─────────────────────────────────────────────────────┐   │</span></span>
<span class="line"><span>│  │  📝 Godot 4.0 入门教程                               │   │</span></span>
<span class="line"><span>│  │     2024-01-10 · ❤️ 89 · 💬 15                     │   │</span></span>
<span class="line"><span>│  └─────────────────────────────────────────────────────┘   │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>└─────────────────────────────────────────────────────────────┘</span></span></code></pre></div><p><strong>跳转逻辑</strong>：</p><ul><li>点击文章 → <code>/articles/:id</code></li><li>点击头像 → 查看大图（暂不实现）</li></ul><hr><h3 id="_8-3-8-个人设置-user-settings" tabindex="-1">8.3.8 个人设置 <code>/user/settings</code> <a class="header-anchor" href="#_8-3-8-个人设置-user-settings" aria-label="Permalink to &quot;8.3.8 个人设置 \`/user/settings\`&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>┌─────────────────────────────────────────────────────────────┐</span></span>
<span class="line"><span>│  LOGO    首页  文章  作品  关于      🔍 搜索    👤 张三 [退出] │</span></span>
<span class="line"><span>├─────────────────────────────────────────────────────────────┤</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  ⚙️ 个人设置                                                │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  ┌─────────────────────────────────────────────────────┐   │</span></span>
<span class="line"><span>│  │                                                     │   │</span></span>
<span class="line"><span>│  │  头像                                               │   │</span></span>
<span class="line"><span>│  │  ┌─────────┐                                        │   │</span></span>
<span class="line"><span>│  │  │  头像   │  [上传新头像]                           │   │</span></span>
<span class="line"><span>│  │  │         │                                        │   │</span></span>
<span class="line"><span>│  │  └─────────┘                                        │   │</span></span>
<span class="line"><span>│  │                                                     │   │</span></span>
<span class="line"><span>│  │  昵称                                               │   │</span></span>
<span class="line"><span>│  │  [ 张三                    ]                         │   │</span></span>
<span class="line"><span>│  │                                                     │   │</span></span>
<span class="line"><span>│  │  个人简介                                           │   │</span></span>
<span class="line"><span>│  │  [ 这是个人简介...           ]                       │   │</span></span>
<span class="line"><span>│  │  [                          ]                       │   │</span></span>
<span class="line"><span>│  │                                                     │   │</span></span>
<span class="line"><span>│  │  ─────────────────────────────────────────────────  │   │</span></span>
<span class="line"><span>│  │                                                     │   │</span></span>
<span class="line"><span>│  │  ⚠️ 修改昵称、头像、简介需要管理员审核              │   │</span></span>
<span class="line"><span>│  │     提交后将在审核通过后生效                         │   │</span></span>
<span class="line"><span>│  │                                                     │   │</span></span>
<span class="line"><span>│  │  [ 保存修改 ]                                       │   │</span></span>
<span class="line"><span>│  │                                                     │   │</span></span>
<span class="line"><span>│  └─────────────────────────────────────────────────────┘   │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>└─────────────────────────────────────────────────────────────┘</span></span></code></pre></div><p><strong>跳转逻辑</strong>：</p><ul><li>点击「保存修改」→ 提交审核 → 显示&quot;已提交，等待审核&quot;</li><li>审核通过后更新显示</li></ul><hr><h3 id="_8-3-9-我的文章-user-articles" tabindex="-1">8.3.9 我的文章 <code>/user/articles</code> <a class="header-anchor" href="#_8-3-9-我的文章-user-articles" aria-label="Permalink to &quot;8.3.9 我的文章 \`/user/articles\`&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>┌─────────────────────────────────────────────────────────────┐</span></span>
<span class="line"><span>│  LOGO    首页  文章  作品  关于      🔍 搜索    👤 张三 [退出] │</span></span>
<span class="line"><span>├─────────────────────────────────────────────────────────────┤</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  📝 我的文章                     [+ 新建文章]                │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>├────────────┬────────────────────────────────────────────────┤</span></span>
<span class="line"><span>│            │                                                │</span></span>
<span class="line"><span>│  📄 草稿   │  草稿 (2)                                     │</span></span>
<span class="line"><span>│  ✅ 已发布 │                                                │</span></span>
<span class="line"><span>│  ❌ 退回   │  ┌─────────────────────────────────────────┐   │</span></span>
<span class="line"><span>│            │  │ 📝 新手入门指南                          │   │</span></span>
<span class="line"><span>│            │  │    2024-01-20 · 未提交                   │   │</span></span>
<span class="line"><span>│            │  │    [编辑]  [删除]                        │   │</span></span>
<span class="line"><span>│            │  └─────────────────────────────────────────┘   │</span></span>
<span class="line"><span>│            │                                                │</span></span>
<span class="line"><span>│            │  ┌─────────────────────────────────────────┐   │</span></span>
<span class="line"><span>│            │  │ 📝 Unity 进阶技巧                        │   │</span></span>
<span class="line"><span>│            │  │    2024-01-18 · 未提交                   │   │</span></span>
<span class="line"><span>│            │  │    [编辑]  [删除]                        │   │</span></span>
<span class="line"><span>│            │  └─────────────────────────────────────────┘   │</span></span>
<span class="line"><span>│            │                                                │</span></span>
<span class="line"><span>└────────────┴────────────────────────────────────────────────┘</span></span></code></pre></div><p><strong>已发布标签页</strong>：</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>├────────────┬────────────────────────────────────────────────┤</span></span>
<span class="line"><span>│            │                                                │</span></span>
<span class="line"><span>│  📄 草稿   │  已发布 (5)                                    │</span></span>
<span class="line"><span>│  ✅ 已发布 │                                                │</span></span>
<span class="line"><span>│  ❌ 退回   │  ┌─────────────────────────────────────────┐   │</span></span>
<span class="line"><span>│            │  │ ✅ Unity 2D 光照系统入门指南              │   │</span></span>
<span class="line"><span>│            │  │    2024-01-15 · ❤️ 128 · 💬 23          │   │</span></span>
<span class="line"><span>│            │  │    [查看]  [编辑]                        │   │</span></span>
<span class="line"><span>│            │  └─────────────────────────────────────────┘   │</span></span>
<span class="line"><span>│            │                                                │</span></span>
<span class="line"><span>└────────────┴────────────────────────────────────────────────┘</span></span></code></pre></div><p><strong>退回标签页</strong>：</p><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>├────────────┬────────────────────────────────────────────────┤</span></span>
<span class="line"><span>│            │                                                │</span></span>
<span class="line"><span>│  📄 草稿   │  退回 (1)                                      │</span></span>
<span class="line"><span>│  ✅ 已发布 │                                                │</span></span>
<span class="line"><span>│  ❌ 退回   │  ┌─────────────────────────────────────────┐   │</span></span>
<span class="line"><span>│            │  │ ❌ 游戏优化技巧分享                      │   │</span></span>
<span class="line"><span>│            │  │    2024-01-18 · 退回                    │   │</span></span>
<span class="line"><span>│            │  │    退回原因：内容不够详细                │   │</span></span>
<span class="line"><span>│            │  │    [编辑]  [重新提交]  [删除]            │   │</span></span>
<span class="line"><span>│            │  └─────────────────────────────────────────┘   │</span></span>
<span class="line"><span>│            │                                                │</span></span>
<span class="line"><span>└────────────┴────────────────────────────────────────────────┘</span></span></code></pre></div><p><strong>跳转逻辑</strong>：</p><ul><li>点击「新建文章」→ <code>/user/editor</code></li><li>点击「编辑」→ <code>/user/editor/:id</code></li><li>点击「查看」→ <code>/articles/:id</code></li><li>点击「删除」→ 确认后删除</li><li>点击「重新提交」→ 提交审核</li></ul><hr><h3 id="_8-3-10-管理后台-admin" tabindex="-1">8.3.10 管理后台 <code>/admin</code> <a class="header-anchor" href="#_8-3-10-管理后台-admin" aria-label="Permalink to &quot;8.3.10 管理后台 \`/admin\`&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>┌─────────────────────────────────────────────────────────────┐</span></span>
<span class="line"><span>│  LOGO    首页  文章  作品  关于      🔍 搜索    👤 管理员 [退出]│</span></span>
<span class="line"><span>├─────────────────────────────────────────────────────────────┤</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  📊 管理后台                                                │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>├────────────┬────────────────────────────────────────────────┤</span></span>
<span class="line"><span>│            │                                                │</span></span>
<span class="line"><span>│  📝 文章   │  📝 文章管理                     [+ 新建文章]   │</span></span>
<span class="line"><span>│  🔄 审核   │                                                │</span></span>
<span class="line"><span>│  👥 用户   │  状态    标题              作者    操作         │</span></span>
<span class="line"><span>│  🔗 邀请   │  ────────────────────────────────────────────  │</span></span>
<span class="line"><span>│  ⚙️ 资料审核│  ✅已发布 Unity 2D光照入门   张三   [编辑][删除] │</span></span>
<span class="line"><span>│            │  🔄审核中 Godot 4.0教程     李四   [审核][删除] │</span></span>
<span class="line"><span>│            │  📝草稿   新手入门指南      王五   [编辑][删除] │</span></span>
<span class="line"><span>│            │                                                │</span></span>
<span class="line"><span>│            │  分页：&lt; 1 2 3 ... 10 &gt;                        │</span></span>
<span class="line"><span>│            │                                                │</span></span>
<span class="line"><span>└────────────┴────────────────────────────────────────────────┘</span></span></code></pre></div><p><strong>跳转逻辑</strong>：</p><ul><li>点击「文章」→ 文章管理列表</li><li>点击「审核」→ 审核队列</li><li>点击「用户」→ 用户管理</li><li>点击「邀请」→ 邀请链接管理</li><li>点击「资料审核」→ 资料修改审核队列</li><li>点击「新建文章」→ <code>/admin/editor</code></li><li>点击「编辑」→ <code>/admin/editor/:id</code></li></ul><hr><h3 id="_8-3-8-编辑文章-admin-editor-id" tabindex="-1">8.3.8 编辑文章 <code>/admin/editor/:id?</code> <a class="header-anchor" href="#_8-3-8-编辑文章-admin-editor-id" aria-label="Permalink to &quot;8.3.8 编辑文章 \`/admin/editor/:id?\`&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>┌─────────────────────────────────────────────────────────────┐</span></span>
<span class="line"><span>│  ← 返回管理后台          ✏️ 编辑文章      [保存草稿] [提交审核] │</span></span>
<span class="line"><span>├─────────────────────────────────────────────────────────────┤</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  标题：[Unity 2D 光照系统入门指南                     ]       │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  摘要：[在 Unity 2021+ 中，我们可以使用 URP 来实现...  ]     │</span></span>
<span class="line"><span>│        [                                            ]       │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  封面图：[点击上传或拖拽图片         ]                        │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  标签：[Unity] [2D游戏] [教程]  [+ 添加标签]                 │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  可见性：(●) 公开  ( ) 内部成员                               │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>├─────────────────────────────────────────────────────────────┤</span></span>
<span class="line"><span>│  正文                                                       │</span></span>
<span class="line"><span>│  ┌─────────────────────────────────────────────────────┐   │</span></span>
<span class="line"><span>│  │                                                     │   │</span></span>
<span class="line"><span>│  │  Unity 2D 光照系统入门指南                           │   │</span></span>
<span class="line"><span>│  │                                                     │   │</span></span>
<span class="line"><span>│  │  这是一篇关于 Unity 2D 光照的教程...                 │   │</span></span>
<span class="line"><span>│  │                                                     │   │</span></span>
<span class="line"><span>│  │  ┌─────────────────────────────────────────────┐   │   │</span></span>
<span class="line"><span>│  │  │  public Light2D light;                      │   │   │</span></span>
<span class="line"><span>│  │  └─────────────────────────────────────────────┘   │   │</span></span>
<span class="line"><span>│  │                                                     │   │</span></span>
<span class="line"><span>│  │  + 添加块                                           │   │</span></span>
<span class="line"><span>│  │                                                     │   │</span></span>
<span class="line"><span>│  └─────────────────────────────────────────────────────┘   │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>└─────────────────────────────────────────────────────────────┘</span></span></code></pre></div><p><strong>跳转逻辑</strong>：</p><ul><li>点击「返回管理后台」→ <code>/admin</code></li><li>点击「保存草稿」→ 保存后留在当前页</li><li>点击「提交审核」→ 提交后跳转到 <code>/admin</code></li><li>新建文章时 <code>:id</code> 为空</li></ul><hr><h3 id="_8-3-9-审核队列-admin-review" tabindex="-1">8.3.9 审核队列 <code>/admin/review</code> <a class="header-anchor" href="#_8-3-9-审核队列-admin-review" aria-label="Permalink to &quot;8.3.9 审核队列 \`/admin/review\`&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>┌─────────────────────────────────────────────────────────────┐</span></span>
<span class="line"><span>│  ← 返回管理后台          🔄 审核队列                         │</span></span>
<span class="line"><span>├─────────────────────────────────────────────────────────────┤</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  待审核文章 (3)                                              │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  ┌─────────────────────────────────────────────────────┐   │</span></span>
<span class="line"><span>│  │  📝 Godot 4.0 入门教程                               │   │</span></span>
<span class="line"><span>│  │     作者：李四 · 提交时间：2024-01-10                │   │</span></span>
<span class="line"><span>│  │     标签：Godot 入门                                 │   │</span></span>
<span class="line"><span>│  │                                                     │   │</span></span>
<span class="line"><span>│  │     [查看文章]  [通过]  [驳回]                       │   │</span></span>
<span class="line"><span>│  └─────────────────────────────────────────────────────┘   │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  ┌─────────────────────────────────────────────────────┐   │</span></span>
<span class="line"><span>│  │  📝 游戏优化技巧分享                                 │   │</span></span>
<span class="line"><span>│  │     作者：王五 · 提交时间：2024-01-09                │   │</span></span>
<span class="line"><span>│  │     标签：进阶 Unity                                 │   │</span></span>
<span class="line"><span>│  │                                                     │   │</span></span>
<span class="line"><span>│  │     [查看文章]  [通过]  [驳回]                       │   │</span></span>
<span class="line"><span>│  └─────────────────────────────────────────────────────┘   │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>└─────────────────────────────────────────────────────────────┘</span></span></code></pre></div><p><strong>跳转逻辑</strong>：</p><ul><li>点击「查看文章」→ 预览文章详情</li><li>点击「通过」→ 文章发布，从列表移除</li><li>点击「驳回」→ 弹出输入框填写原因，从列表移除</li></ul><hr><h3 id="_8-3-10-用户管理-admin-users" tabindex="-1">8.3.10 用户管理 <code>/admin/users</code> <a class="header-anchor" href="#_8-3-10-用户管理-admin-users" aria-label="Permalink to &quot;8.3.10 用户管理 \`/admin/users\`&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>┌─────────────────────────────────────────────────────────────┐</span></span>
<span class="line"><span>│  ← 返回管理后台          👥 用户管理                         │</span></span>
<span class="line"><span>├─────────────────────────────────────────────────────────────┤</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  🔍 搜索用户...                                             │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  ┌─────────────────────────────────────────────────────┐   │</span></span>
<span class="line"><span>│  │  用户名      邮箱            角色    操作             │   │</span></span>
<span class="line"><span>│  ├─────────────────────────────────────────────────────┤   │</span></span>
<span class="line"><span>│  │  张三      zhang@email.com   管理员  -               │   │</span></span>
<span class="line"><span>│  │  李四      li@email.com      社员   [设为管理员]     │   │</span></span>
<span class="line"><span>│  │  王五      wang@email.com    社员   [设为管理员]     │   │</span></span>
<span class="line"><span>│  │  赵六      zhao@email.com    社员   [移除]           │   │</span></span>
<span class="line"><span>│  └─────────────────────────────────────────────────────┘   │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>└─────────────────────────────────────────────────────────────┘</span></span></code></pre></div><p><strong>跳转逻辑</strong>：</p><ul><li>点击「设为管理员」→ 确认后更新角色</li><li>点击「移除」→ 确认后移除用户</li></ul><hr><h3 id="_8-3-11-资料审核-admin-profile-review" tabindex="-1">8.3.11 资料审核 <code>/admin/profile-review</code> <a class="header-anchor" href="#_8-3-11-资料审核-admin-profile-review" aria-label="Permalink to &quot;8.3.11 资料审核 \`/admin/profile-review\`&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>┌─────────────────────────────────────────────────────────────┐</span></span>
<span class="line"><span>│  ← 返回管理后台          ⚙️ 资料审核                         │</span></span>
<span class="line"><span>├─────────────────────────────────────────────────────────────┤</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  待审核资料修改 (2)                                          │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  ┌─────────────────────────────────────────────────────┐   │</span></span>
<span class="line"><span>│  │  👤 张三                                             │   │</span></span>
<span class="line"><span>│  │                                                     │   │</span></span>
<span class="line"><span>│  │  修改内容：                                          │   │</span></span>
<span class="line"><span>│  │  - 头像：[新头像预览]                                │   │</span></span>
<span class="line"><span>│  │  - 昵称：张三 → 游戏开发者张三                       │   │</span></span>
<span class="line"><span>│  │  - 简介：热爱游戏开发... → 专注Unity开发5年...       │   │</span></span>
<span class="line"><span>│  │                                                     │   │</span></span>
<span class="line"><span>│  │     [通过]  [驳回]                                   │   │</span></span>
<span class="line"><span>│  └─────────────────────────────────────────────────────┘   │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  ┌─────────────────────────────────────────────────────┐   │</span></span>
<span class="line"><span>│  │  👤 李四                                             │   │</span></span>
<span class="line"><span>│  │                                                     │   │</span></span>
<span class="line"><span>│  │  修改内容：                                          │   │</span></span>
<span class="line"><span>│  │  - 头像：[新头像预览]                                │   │</span></span>
<span class="line"><span>│  │                                                     │   │</span></span>
<span class="line"><span>│  │     [通过]  [驳回]                                   │   │</span></span>
<span class="line"><span>│  └─────────────────────────────────────────────────────┘   │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>└─────────────────────────────────────────────────────────────┘</span></span></code></pre></div><p><strong>跳转逻辑</strong>：</p><ul><li>点击「通过」→ 更新用户资料，从列表移除</li><li>点击「驳回」→ 弹出输入框填写原因，从列表移除</li></ul><hr><h3 id="_8-3-12-邀请链接管理-admin-invites" tabindex="-1">8.3.12 邀请链接管理 <code>/admin/invites</code> <a class="header-anchor" href="#_8-3-12-邀请链接管理-admin-invites" aria-label="Permalink to &quot;8.3.12 邀请链接管理 \`/admin/invites\`&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>┌─────────────────────────────────────────────────────────────┐</span></span>
<span class="line"><span>│  ← 返回管理后台          🔗 邀请链接管理                     │</span></span>
<span class="line"><span>├─────────────────────────────────────────────────────────────┤</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  生成新链接                                                  │</span></span>
<span class="line"><span>│  ┌─────────────────────────────────────────────────────┐   │</span></span>
<span class="line"><span>│  │  有效期：[ 7 ] 天                                    │   │</span></span>
<span class="line"><span>│  │  生成数量：[ 5 ] 个                                 │   │</span></span>
<span class="line"><span>│  │  [ 生成链接 ]                                       │   │</span></span>
<span class="line"><span>│  └─────────────────────────────────────────────────────┘   │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  已生成的链接                                                │</span></span>
<span class="line"><span>│  ┌─────────────────────────────────────────────────────┐   │</span></span>
<span class="line"><span>│  │  链接                    有效期    状态    操作       │   │</span></span>
<span class="line"><span>│  ├─────────────────────────────────────────────────────┤   │</span></span>
<span class="line"><span>│  │  /invite/abc123    2024-01-22  未使用  [复制][删除]  │   │</span></span>
<span class="line"><span>│  │  /invite/def456    2024-01-22  已使用  -            │   │</span></span>
<span class="line"><span>│  │  /invite/ghi789    2024-01-22  未使用  [复制][删除]  │   │</span></span>
<span class="line"><span>│  └─────────────────────────────────────────────────────┘   │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>│  [ 全部复制 ]                                                │</span></span>
<span class="line"><span>│                                                             │</span></span>
<span class="line"><span>└─────────────────────────────────────────────────────────────┘</span></span></code></pre></div><p><strong>跳转逻辑</strong>：</p><ul><li>点击「生成链接」→ 生成后显示在列表</li><li>点击「复制」→ 复制链接到剪贴板</li><li>点击「全部复制」→ 复制所有未使用链接</li><li>点击「删除」→ 确认后删除链接</li></ul><hr><h2 id="_8-4-路由配置" tabindex="-1">8.4 路由配置 <a class="header-anchor" href="#_8-4-路由配置" aria-label="Permalink to &quot;8.4 路由配置&quot;">​</a></h2><div class="language-typescript vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">typescript</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// router/index.ts</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> routes</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> [</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  // 公开页面</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  { path: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;/&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, component: Home },</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  { path: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;/articles&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, component: ArticleList },</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  { path: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;/articles/:id&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, component: ArticleDetail },</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  { path: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;/internal&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, component: InternalArticles, meta: { requiresAuth: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">true</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, role: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;member&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> } },</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  { path: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;/internal/:id&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, component: InternalArticleDetail, meta: { requiresAuth: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">true</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, role: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;member&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> } },</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  { path: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;/works&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, component: Works },</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  { path: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;/about&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, component: About },</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  </span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  // 认证页面</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  { path: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;/login&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, component: Login },</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  { path: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;/invite/:code&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, component: InviteAccept },</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  </span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  // 用户页面</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  { path: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;/user/:id&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, component: UserProfile },</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  { path: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;/user/settings&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, component: UserSettings, meta: { requiresAuth: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">true</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> } },</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  { path: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;/user/articles&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, component: MyArticles, meta: { requiresAuth: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">true</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> } },</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  { path: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;/user/editor/:id?&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, component: UserArticleEditor, meta: { requiresAuth: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">true</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, role: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;member&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> } },</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  </span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  // 管理后台</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  { </span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    path: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;/admin&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    component: AdminLayout,</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    meta: { requiresAuth: </span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">true</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, role: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;admin&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> },</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    children: [</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">      { path: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, component: AdminDashboard },</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">      { path: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;articles&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, component: ArticleManagement },</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">      { path: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;editor/:id?&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, component: ArticleEditor, meta: { role: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;member&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> } },</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">      { path: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;review&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, component: ReviewQueue, meta: { role: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;admin&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> } },</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">      { path: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;profile-review&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, component: ProfileReview, meta: { role: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;admin&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> } },</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">      { path: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;users&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, component: UserManagement, meta: { role: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;admin&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> } },</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">      { path: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;invites&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, component: InviteManagement, meta: { role: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;admin&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> } },</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    ]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  }</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">]</span></span></code></pre></div><h2 id="_8-5-权限控制" tabindex="-1">8.5 权限控制 <a class="header-anchor" href="#_8-5-权限控制" aria-label="Permalink to &quot;8.5 权限控制&quot;">​</a></h2><div class="language-typescript vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">typescript</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// 路由守卫</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">router.</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">beforeEach</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">((</span><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70;">to</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70;">from</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70;">next</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">) </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">=&gt;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> {</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">  const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> user</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> useUserStore</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">()</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  </span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  // 需要登录的页面</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">  if</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> (to.meta.requiresAuth </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">&amp;&amp;</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> !</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">user.isLoggedIn) {</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">    return</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> next</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">({ path: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;/login&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, query: { redirect: to.fullPath } })</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  }</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  </span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">  // 需要特定角色的页面</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">  if</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> (to.meta.role </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">&amp;&amp;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> user.role </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">!==</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> to.meta.role) {</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">    return</span><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;"> next</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">(</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&#39;/&#39;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">)  </span><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// 或显示无权限页面</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  }</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  </span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">  next</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">()</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">})</span></span></code></pre></div><hr><blockquote><p>📄 <strong>相关文档</strong></p><ul><li><a href="./01-项目概述.html">项目概述</a></li><li><a href="./02-用户权限系统.html">用户权限系统</a></li><li><a href="./03-文章系统.html">文章系统</a></li></ul></blockquote>`,91)])])}const E=n(l,[["render",e]]);export{o as __pageData,E as default};
