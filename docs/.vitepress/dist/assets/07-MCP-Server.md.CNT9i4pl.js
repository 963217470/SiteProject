import{c as a,S as n,j as i,m as t}from"./chunks/framework.DT_SM_aS.js";const c=JSON.parse('{"title":"七、MCP Server 设计（后续开发）","description":"","frontmatter":{},"headers":[],"relativePath":"07-MCP-Server.md","filePath":"07-MCP-Server.md"}'),p={name:"07-MCP-Server.md"};function l(e,s,h,d,r,k){return n(),i("div",null,[...s[0]||(s[0]=[t(`<h1 id="七、mcp-server-设计-后续开发" tabindex="-1">七、MCP Server 设计（后续开发） <a class="header-anchor" href="#七、mcp-server-设计-后续开发" aria-label="Permalink to &quot;七、MCP Server 设计（后续开发）&quot;">​</a></h1><blockquote><p>⏳ <strong>此功能暂不实现，后续开发</strong></p></blockquote><h2 id="_7-1-方案说明" tabindex="-1">7.1 方案说明 <a class="header-anchor" href="#_7-1-方案说明" aria-label="Permalink to &quot;7.1 方案说明&quot;">​</a></h2><p>搭建 MCP (Model Context Protocol) Server，让内部成员通过 Claude Code 直接读取和搜索社团文档。</p><h2 id="_7-2-架构设计" tabindex="-1">7.2 架构设计 <a class="header-anchor" href="#_7-2-架构设计" aria-label="Permalink to &quot;7.2 架构设计&quot;">​</a></h2><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>┌─────────────────────────────────────────────────────────────┐</span></span>
<span class="line"><span>│                     Claude Code                              │</span></span>
<span class="line"><span>│                         │                                     │</span></span>
<span class="line"><span>│                    MCP Protocol                               │</span></span>
<span class="line"><span>│                         │                                     │</span></span>
<span class="line"><span>│                         ▼                                     │</span></span>
<span class="line"><span>│               ┌─────────────────┐                            │</span></span>
<span class="line"><span>│               │   MCP Server    │                            │</span></span>
<span class="line"><span>│               │  (Node.js)     │                            │</span></span>
<span class="line"><span>│               └────────┬────────┘                            │</span></span>
<span class="line"><span>│                        │                                      │</span></span>
<span class="line"><span>│           ┌────────────┼────────────┐                        │</span></span>
<span class="line"><span>│           ▼            ▼            ▼                        │</span></span>
<span class="line"><span>│     ┌──────────┐ ┌──────────┐ ┌──────────┐                  │</span></span>
<span class="line"><span>│     │ 搜索文章 │ │ 获取文章 │ │ 文章统计 │                  │</span></span>
<span class="line"><span>│     └──────────┘ └──────────┘ └──────────┘                  │</span></span>
<span class="line"><span>│           │            │            │                        │</span></span>
<span class="line"><span>│           └────────────┼────────────┘                        │</span></span>
<span class="line"><span>│                        ▼                                      │</span></span>
<span class="line"><span>│               ┌─────────────────┐                            │</span></span>
<span class="line"><span>│               │  GitHub API     │                            │</span></span>
<span class="line"><span>│               │  (读取仓库)     │                            │</span></span>
<span class="line"><span>│               └─────────────────┘                            │</span></span>
<span class="line"><span>│                        │                                      │</span></span>
<span class="line"><span>│                        ▼                                      │</span></span>
<span class="line"><span>│               ┌─────────────────┐                            │</span></span>
<span class="line"><span>│               │  GitHub 仓库    │                            │</span></span>
<span class="line"><span>│               │  (Markdown文件) │                            │</span></span>
<span class="line"><span>│               └─────────────────┘                            │</span></span>
<span class="line"><span>└─────────────────────────────────────────────────────────────┘</span></span></code></pre></div><h2 id="_7-3-mcp-工具列表" tabindex="-1">7.3 MCP 工具列表 <a class="header-anchor" href="#_7-3-mcp-工具列表" aria-label="Permalink to &quot;7.3 MCP 工具列表&quot;">​</a></h2><table tabindex="0"><thead><tr><th>工具名</th><th>功能</th><th>使用场景</th></tr></thead><tbody><tr><td><code>search_articles</code></td><td>搜索文章内容</td><td>&quot;找一下 Unity 相关的文章&quot;</td></tr><tr><td><code>get_article</code></td><td>获取指定文章</td><td>&quot;帮我读一下这篇文章&quot;</td></tr><tr><td><code>list_articles</code></td><td>列出文章列表</td><td>&quot;最近有哪些文章？&quot;</td></tr><tr><td><code>get_article_stats</code></td><td>获取文章统计</td><td>&quot;这篇文章有多少点赞？&quot;</td></tr><tr><td><code>get_related_articles</code></td><td>获取相关文章</td><td>&quot;有没有和这篇文章类似的？&quot;</td></tr></tbody></table><h2 id="_7-4-使用示例" tabindex="-1">7.4 使用示例 <a class="header-anchor" href="#_7-4-使用示例" aria-label="Permalink to &quot;7.4 使用示例&quot;">​</a></h2><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>用户: 帮我找一下关于 Godot 引擎的教程</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Claude: 我通过 MCP Server 搜索到以下 Godot 相关文章：</span></span>
<span class="line"><span></span></span>
<span class="line"><span>1. 📝 《Godot 4.0 入门教程》</span></span>
<span class="line"><span>   - 作者：张三</span></span>
<span class="line"><span>   - 分类：技术分享</span></span>
<span class="line"><span>   - 标签：Godot, 入门, 2D游戏</span></span>
<span class="line"><span>   - 点赞：128</span></span>
<span class="line"><span></span></span>
<span class="line"><span>2. 📝 《GDScript 语法详解》</span></span>
<span class="line"><span>   - 作者：李四</span></span>
<span class="line"><span>   - 分类：技术分享</span></span>
<span class="line"><span>   - 标签：Godot, GDScript, 进阶</span></span>
<span class="line"><span>   - 点赞：89</span></span>
<span class="line"><span></span></span>
<span class="line"><span>要我详细阅读哪一篇？</span></span>
<span class="line"><span></span></span>
<span class="line"><span>用户: 读一下第一篇的完整内容</span></span>
<span class="line"><span></span></span>
<span class="line"><span>Claude: [通过 MCP Server 获取文章完整内容并显示]</span></span></code></pre></div><h2 id="_7-5-技术实现概览" tabindex="-1">7.5 技术实现概览 <a class="header-anchor" href="#_7-5-技术实现概览" aria-label="Permalink to &quot;7.5 技术实现概览&quot;">​</a></h2><h3 id="项目结构" tabindex="-1">项目结构 <a class="header-anchor" href="#项目结构" aria-label="Permalink to &quot;项目结构&quot;">​</a></h3><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>mcp-server/</span></span>
<span class="line"><span>├── src/</span></span>
<span class="line"><span>│   ├── index.ts          # MCP Server 入口</span></span>
<span class="line"><span>│   ├── tools/</span></span>
<span class="line"><span>│   │   ├── search.ts     # 搜索工具</span></span>
<span class="line"><span>│   │   ├── getArticle.ts # 获取文章</span></span>
<span class="line"><span>│   │   └── listArticles.ts # 列出文章</span></span>
<span class="line"><span>│   └── services/</span></span>
<span class="line"><span>│       └── github.ts     # GitHub API 服务</span></span>
<span class="line"><span>├── package.json</span></span>
<span class="line"><span>└── README.md</span></span></code></pre></div><h3 id="工具定义示例" tabindex="-1">工具定义示例 <a class="header-anchor" href="#工具定义示例" aria-label="Permalink to &quot;工具定义示例&quot;">​</a></h3><div class="language-typescript vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">typescript</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">// src/tools/search.ts</span></span>
<span class="line"><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">export</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> const</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> searchTool</span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;"> =</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> {</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  name: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;search_articles&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  description: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;搜索社团内部文章&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  inputSchema: {</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    type: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;object&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    properties: {</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">      query: {</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        type: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;string&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        description: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;搜索关键词&quot;</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">      },</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">      category: {</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        type: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;string&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        description: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;分类筛选&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        enum: [</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;技术分享&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;作品展示&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;活动通知&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">, </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;公告&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">      },</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">      tags: {</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        type: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;array&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        items: { type: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;string&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> },</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">        description: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;标签筛选&quot;</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">      }</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    },</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    required: [</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;query&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">]</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  },</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">  handler</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">async</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> (</span><span style="--shiki-light:#E36209;--shiki-dark:#FFAB70;">params</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">) </span><span style="--shiki-light:#D73A49;--shiki-dark:#F97583;">=&gt;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;"> {</span></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;">    // 实现搜索逻辑</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  }</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">}</span></span></code></pre></div><h2 id="_7-6-部署方案" tabindex="-1">7.6 部署方案 <a class="header-anchor" href="#_7-6-部署方案" aria-label="Permalink to &quot;7.6 部署方案&quot;">​</a></h2><h3 id="免费平台选择" tabindex="-1">免费平台选择 <a class="header-anchor" href="#免费平台选择" aria-label="Permalink to &quot;免费平台选择&quot;">​</a></h3><table tabindex="0"><thead><tr><th>平台</th><th>优势</th><th>限制</th></tr></thead><tbody><tr><td><strong>Railway</strong></td><td>免费额度充足，部署简单</td><td>每月 $5 免费额度</td></tr><tr><td><strong>Render</strong></td><td>免费计划</td><td>15分钟无请求会休眠</td></tr><tr><td><strong>Fly.io</strong></td><td>免费额度</td><td>需要信用卡验证</td></tr></tbody></table><h3 id="推荐-railway" tabindex="-1">推荐 Railway <a class="header-anchor" href="#推荐-railway" aria-label="Permalink to &quot;推荐 Railway&quot;">​</a></h3><div class="language-bash vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">bash</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># 安装 Railway CLI</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">npm</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> install</span><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;"> -g</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> @railway/cli</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># 登录</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">railway</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> login</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># 初始化项目</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">railway</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> init</span></span>
<span class="line"></span>
<span class="line"><span style="--shiki-light:#6A737D;--shiki-dark:#6A737D;"># 部署</span></span>
<span class="line"><span style="--shiki-light:#6F42C1;--shiki-dark:#B392F0;">railway</span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;"> up</span></span></code></pre></div><h2 id="_7-7-社员配置" tabindex="-1">7.7 社员配置 <a class="header-anchor" href="#_7-7-社员配置" aria-label="Permalink to &quot;7.7 社员配置&quot;">​</a></h2><p>社员只需在 Claude Code 配置中添加：</p><div class="language-json vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang">json</span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">{</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">  &quot;mcpServers&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: {</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">    &quot;game-dev-club&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: {</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">      &quot;url&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;https://your-mcp-server.up.railway.app/mcp&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">,</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">      &quot;headers&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: {</span></span>
<span class="line"><span style="--shiki-light:#005CC5;--shiki-dark:#79B8FF;">        &quot;Authorization&quot;</span><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">: </span><span style="--shiki-light:#032F62;--shiki-dark:#9ECBFF;">&quot;Bearer YOUR_TOKEN&quot;</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">      }</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">    }</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">  }</span></span>
<span class="line"><span style="--shiki-light:#24292E;--shiki-dark:#E1E4E8;">}</span></span></code></pre></div><p>或者使用项目级配置 <code>.claude/settings.json</code>。</p><h2 id="_7-8-安全设计" tabindex="-1">7.8 安全设计 <a class="header-anchor" href="#_7-8-安全设计" aria-label="Permalink to &quot;7.8 安全设计&quot;">​</a></h2><table tabindex="0"><thead><tr><th>安全措施</th><th>说明</th></tr></thead><tbody><tr><td>Token 认证</td><td>每个社员有独立的访问 Token</td></tr><tr><td>权限分级</td><td>用户只能搜公开文章，社员可搜全部</td></tr><tr><td>速率限制</td><td>防止滥用</td></tr><tr><td>日志审计</td><td>记录查询历史</td></tr></tbody></table><h2 id="_7-9-开发计划" tabindex="-1">7.9 开发计划 <a class="header-anchor" href="#_7-9-开发计划" aria-label="Permalink to &quot;7.9 开发计划&quot;">​</a></h2><table tabindex="0"><thead><tr><th>阶段</th><th>任务</th><th>预计时间</th></tr></thead><tbody><tr><td>1</td><td>基础 MCP Server 搭建</td><td>1天</td></tr><tr><td>2</td><td>GitHub API 集成</td><td>1天</td></tr><tr><td>3</td><td>搜索功能实现</td><td>1天</td></tr><tr><td>4</td><td>部署与测试</td><td>0.5天</td></tr><tr><td>5</td><td>社员文档编写</td><td>0.5天</td></tr><tr><td><strong>总计</strong></td><td></td><td><strong>4天</strong></td></tr></tbody></table><hr><blockquote><p>📄 <strong>相关文档</strong></p><ul><li><a href="./01-项目概述.html">项目概述</a></li><li><a href="./06-部署与运维.html">部署与运维</a></li></ul></blockquote>`,30)])])}const E=a(p,[["render",l]]);export{c as __pageData,E as default};
