# Markdown 渲染与原文保存修复

日期：2026-10-14

## 确认的问题

- 文章详情使用逐行手写解析器，缺少代码围栏解析，与文章编辑器、作品介绍的 markdown-it 行为不一致。
- 文章编辑器会在预览失焦时，把渲染 DOM 反向转换成 Markdown。转换器使用固定三反引号，会破坏包含三反引号的代码示例，也会读取公式的视觉层、辅助 MathML 和原始注释文本。
- 数学定界符只覆盖部分美元符号写法；详情页还异步依赖外部 KaTeX CDN，存在正文渲染早于脚本加载的情况。
- 公式编号的 `.tag` 与网站文章标签样式冲突；作品表单的全宽 input 规则影响任务列表复选框。

## 修改

- 文章编辑器、文章详情、游戏/工具预览及详情共用 Markdown 渲染器，使用 markdown-it 处理 CommonMark 围栏、嵌套列表、表格等。
- 编辑器提供 Markdown、预览、分栏视图，直接保存原文；移除失焦时的 DOM 转 Markdown。导入、图片上传、颜色工具、知识库申请和提交审核继续可用。
- 公式使用本地打包的 KaTeX，支持 `$...$`、`$$...$$`、`\(...\)` 和 `\[...\]`。
- 支持带 `\label{...}` 的块级公式依文档顺序编号，支持正文及行内公式的 `\eqref` / `\ref`、前向引用和简单手动 `\tag{3.1}`。一个展示公式块对应一个编号，`aligned` 可放在块内；不承诺完整 LaTeX 文档、跨文档引用或 align 每行自动编号。
- 复制含公式的选区时，用一份 TeX 源码代替重复的数学 DOM；屏幕阅读器使用的 MathML 保留。普通文本的浏览器原生复制不变。
- 新增 `[TOC]` / `[[toc]]`、脚注、高亮、上下标、表情短码、GFM 提示块、定义列表、任务列表、Obsidian 注释及代码语法高亮。
- Wiki 链接保留；颜色和 8–48px 字号使用受限的 span 样式，其余原始 HTML 按文本显示，阻止脚本和危险链接。

## 范围与原文

- 纯文本复制无法保留图片、粗体、表格边框等视觉样式，这不等于预览失败。
- Mermaid 本轮继续作为带语言标记的代码显示，未接入图表渲染器。
- `@demo2026` 等文献引用没有配套文献数据库，本轮保留原文。
- 不批量修改数据库内容。旧编辑器若已经把转义或公式重复内容保存到正文，需要重新导入原始 Markdown；不能无依据地还原。
- 验证样例：`docs/public/examples/markdown-compatibility.md`，线上可从 `/examples/markdown-compatibility.md` 下载并导入。

## 验证

- 67 项前端测试通过，包括四反引号嵌套三反引号、原文保存一致性、公式引用、脚注、扩展语法、HTML 注入防护及复制去重。
- 独立本地数据库中通过浏览器保存草稿并读取数据库，确认 Markdown 原文逐字一致。
- 浏览器覆盖编辑器、文章详情、作品介绍预览，校验真实公式显示、锚点目标、复制内容、手机布局和样式冲突。

## 发布

- 生产构建通过；示例 Markdown 作为静态下载文件提供，不参与 VitePress 页面编译。
- 已部署版本：`/www/wwwroot/rd-studio.club/releases/rd-ui-20261014T093415Z`。
- 回档备份：`/var/backups/rd-studio/frontend-ui-20261014T093415Z`，备份 SHA256 校验通过。
- 线上编辑器验证公式、代码围栏、脚注及提示块通过；下载样例与原文件一致。线上验证未提交测试文章。

## 依赖参考

- [markdown-it 官方演示](https://markdown-it.github.io/)
- [TeX 定界符插件](https://mdit-plugins.github.io/tex.html)
- [KaTeX 支持表](https://katex.org/docs/support_table.html)：原生不支持的 label/eqref 由本文档范围内的文档级编号逻辑处理。
- [脚注插件](https://github.com/markdown-it/markdown-it-footnote)
