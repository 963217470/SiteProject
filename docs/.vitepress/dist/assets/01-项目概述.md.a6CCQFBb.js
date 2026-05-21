import{c as t,S as s,j as n,m as p}from"./chunks/framework.DOPCDQAF.js";const b=JSON.parse('{"title":"一、项目概述","description":"","frontmatter":{},"headers":[],"relativePath":"01-项目概述.md","filePath":"01-项目概述.md"}'),e={name:"01-项目概述.md"};function d(l,a,i,r,h,c){return s(),n("div",null,[...a[0]||(a[0]=[p(`<h1 id="一、项目概述" tabindex="-1">一、项目概述 <a class="header-anchor" href="#一、项目概述" aria-label="Permalink to &quot;一、项目概述&quot;">​</a></h1><h2 id="_1-1-需求概述" tabindex="-1">1.1 需求概述 <a class="header-anchor" href="#_1-1-需求概述" aria-label="Permalink to &quot;1.1 需求概述&quot;">​</a></h2><table tabindex="0"><thead><tr><th>需求</th><th>说明</th></tr></thead><tbody><tr><td>门户页面</td><td>展示社团介绍、最新动态、作品展示</td></tr><tr><td>文章发布</td><td>社员通过在线编辑或 Git 发布文章</td></tr><tr><td>访问控制</td><td>文章分「公开」和「内部可见」两种</td></tr><tr><td>用户系统</td><td>游客/用户/社员/管理员四种角色</td></tr><tr><td>低成本</td><td>优先使用免费服务</td></tr></tbody></table><h2 id="_1-2-技术选型" tabindex="-1">1.2 技术选型 <a class="header-anchor" href="#_1-2-技术选型" aria-label="Permalink to &quot;1.2 技术选型&quot;">​</a></h2><table tabindex="0"><thead><tr><th>组件</th><th>方案</th><th>说明</th></tr></thead><tbody><tr><td>静态生成</td><td>VitePress</td><td>Vue 驱动，开发体验好</td></tr><tr><td>部署平台</td><td>GitHub Pages</td><td>免费，自带域名</td></tr><tr><td>在线编辑</td><td>Decap CMS</td><td>可视化编辑，类似飞书</td></tr><tr><td>用户认证</td><td>Supabase Auth</td><td>免费 5万用户/月</td></tr><tr><td>评论系统</td><td>Giscus</td><td>基于 GitHub Discussions</td></tr><tr><td>版本控制</td><td>GitHub</td><td>协作管理</td></tr></tbody></table><h2 id="_1-3-核心架构" tabindex="-1">1.3 核心架构 <a class="header-anchor" href="#_1-3-核心架构" aria-label="Permalink to &quot;1.3 核心架构&quot;">​</a></h2><div class="language- vp-adaptive-theme"><button title="Copy Code" class="copy"></button><span class="lang"></span><pre class="shiki shiki-themes github-light github-dark vp-code" tabindex="0"><code><span class="line"><span>┌─────────────────────────────────────────────────────────┐</span></span>
<span class="line"><span>│                      用户界面                            │</span></span>
<span class="line"><span>│  ┌─────────┐  ┌─────────┐  ┌─────────┐                 │</span></span>
<span class="line"><span>│  │  前端   │  │ Decap   │  │  Admin  │                 │</span></span>
<span class="line"><span>│  │ VitePress│  │  CMS    │  │  Panel  │                 │</span></span>
<span class="line"><span>│  └────┬────┘  └────┬────┘  └────┬────┘                 │</span></span>
<span class="line"><span>│       │            │            │                       │</span></span>
<span class="line"><span>├───────┼────────────┼────────────┼───────────────────────┤</span></span>
<span class="line"><span>│       │      服务层 │            │                       │</span></span>
<span class="line"><span>│       ▼            ▼            ▼                       │</span></span>
<span class="line"><span>│  ┌─────────┐  ┌─────────┐  ┌─────────┐                │</span></span>
<span class="line"><span>│  │Supabase │  │ GitHub  │  │ Giscus  │                │</span></span>
<span class="line"><span>│  │  Auth   │  │   API   │  │         │                │</span></span>
<span class="line"><span>│  └─────────┘  └─────────┘  └─────────┘                │</span></span>
<span class="line"><span>│                      │                                  │</span></span>
<span class="line"><span>│                      ▼                                  │</span></span>
<span class="line"><span>│             ┌─────────────────┐                        │</span></span>
<span class="line"><span>│             │  GitHub 仓库    │                        │</span></span>
<span class="line"><span>│             │ (Markdown文件)  │                        │</span></span>
<span class="line"><span>│             └─────────────────┘                        │</span></span>
<span class="line"><span>│                      │                                  │</span></span>
<span class="line"><span>│                      ▼                                  │</span></span>
<span class="line"><span>│             ┌─────────────────┐                        │</span></span>
<span class="line"><span>│             │  GitHub Pages   │                        │</span></span>
<span class="line"><span>│             │  (静态托管)     │                        │</span></span>
<span class="line"><span>│             └─────────────────┘                        │</span></span>
<span class="line"><span>└─────────────────────────────────────────────────────────┘</span></span></code></pre></div><h2 id="_1-4-成本估算" tabindex="-1">1.4 成本估算 <a class="header-anchor" href="#_1-4-成本估算" aria-label="Permalink to &quot;1.4 成本估算&quot;">​</a></h2><table tabindex="0"><thead><tr><th>项目</th><th>费用</th><th>说明</th></tr></thead><tbody><tr><td>GitHub 仓库</td><td>免费</td><td>Public 仓库</td></tr><tr><td>GitHub Pages</td><td>免费</td><td>100GB 带宽/月</td></tr><tr><td>Supabase</td><td>免费</td><td>5万用户/月</td></tr><tr><td><strong>总计</strong></td><td><strong>¥0</strong></td><td></td></tr></tbody></table><hr><blockquote><p>📄 <strong>相关文档</strong></p><ul><li><a href="./02-用户权限系统.html">用户权限系统</a></li><li><a href="./03-文章系统.html">文章系统</a></li><li><a href="./04-在线编辑系统.html">在线编辑系统</a></li><li><a href="./05-评论与点赞系统.html">评论与点赞系统</a></li><li><a href="./06-部署与运维.html">部署与运维</a></li></ul></blockquote>`,11)])])}const u=t(e,[["render",d]]);export{b as __pageData,u as default};
