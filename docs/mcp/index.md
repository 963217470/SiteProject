---
title: AI / MCP 接入
description: RD STUDIO 知识库 MCP 与视频笔记草稿上传
---

# AI / MCP 接入

[下载 MCP 源码与配置包](/mcp/rd-studio-mcp.zip)

连接地址：`https://rd-studio.club/api/mcp`，使用 **Streamable HTTP**。公开查询无需登录；上传笔记需本人授权令牌。

<McpUploadTokens />

<script setup>
import McpUploadTokens from '../.vitepress/theme/components/McpUploadTokens.vue'
</script>

## V2md 笔记上传为草稿

1. 登录后在上方创建上传令牌。
2. 下载连接器，执行 `npm ci`，使用包中的 `upload.stdio.json` 配置本地 MCP。
3. 将 `RD_STUDIO_UPLOAD_TOKEN` 配成新令牌，将 `RD_STUDIO_NOTES_ROOT` 配成允许读取的笔记目录。
4. 让 AI 调用 `upload_video_note`，传入目录中的 `.md` 路径。连接器会上传相对路径图片（包括 `_assets`），替换正文中的图片链接，保留公式与代码，返回草稿预览和编辑地址。

上传成功后到“我的文章”检查、编辑，再提交审核。重复上传相同内容会复用草稿；更新需先调用 `get_own_draft` 获取 `revision`，作为 `expected_revision` 传入。图片最大 5MB，每次最多 100 个图片引用。

远程 HTTP 客户端可配置 `Authorization: Bearer <上传令牌>`，使用 `get_upload_identity`、`upload_note_image`、`save_article_draft` 和 `get_own_draft`。HTTP 服务不能读取你电脑的文件；本地文件夹一键上传使用 stdio 连接器。

## 可用能力

- 搜索已发布的公开文章标题，获得摘要、标签和原文链接。
- 读取文章 Markdown，长文可分段读取。
- 浏览知识库分支，按分支查询公开笔记。
- 获取网站公开入口和 MCP 使用说明。

匿名连接只读取公开资料。上传令牌仅允许读写本人的公开草稿和上传笔记图片，不具备发布、审核、内部资料或经验管理权限。令牌有效期 90 天，可随时撤销。未公开的笔记图片仅作者和管理员可见。

## Claude Code

```sh
claude mcp add --transport http rd-studio https://rd-studio.club/api/mcp
```

## Codex

将下面内容合并到 `~/.codex/config.toml`：

```toml
[mcp_servers.rd_studio]
url = "https://rd-studio.club/api/mcp"
```

## CodeBuddy、WorkBuddy、TRAE、DeepSeek、千问与 Gemini

下载包内已提供各客户端配置和 `CLIENTS.md` 接入指南：

| 客户端 | 公开查询 | V2md 本地上传 | 配置入口 |
| --- | --- | --- | --- |
| CodeBuddy Code / IDE | `codebuddy.http.json`（Code）或 `generic.stdio.json`（IDE） | `codebuddy.upload.stdio.json` | Code 用户 MCP 配置；IDE 的 MCP 设置 |
| WorkBuddy | `workbuddy.stdio.json` | `workbuddy.upload.stdio.json` | 插件 → MCP 服务器 → 配置 MCP |
| TRAE（trea） | `trae.stdio.json` | `trae.upload.stdio.json` | MCP 设置中手动添加 |
| DeepSeek Harness | `deepseek-harness.http.patch.yaml` | `deepseek-harness.upload.patch.yaml` | 当前 profile 的 `cordis.patch.yml` |
| 千问 Qwen Code | `qwen-code.http.json` | `qwen-code.upload.stdio.json` | `~/.qwen/settings.json` |
| Gemini CLI | `gemini-cli.http.json` | `gemini-cli.upload.stdio.json` | `~/.gemini/settings.json` |

千问和 Gemini 在这里指支持 MCP 的 Qwen Code、Gemini CLI；普通网页聊天的接入入口取决于产品版本。配置只需合并相应的 `mcpServers` 条目，保留原来的其他服务器。

本地上传配置需要 Node.js 20+。在解压目录执行 `npm ci`，将 `args` 改为本机 `server.mjs` 的绝对路径，再填写本人上传令牌和笔记目录。GUI 客户端找不到 Node 时，将 `command` 改为 `node.exe` 的绝对路径。

DeepSeek Harness 使用官方 `@deepseek-ai/dsh-mcp-client` 插件。`.patch.yaml` 是 Cordis patch 文件，需合并到当前 profile；原有 `deepseek-harness.http.yaml` 是插件列表条目，不要混用。上传 patch 从启动环境读取令牌和目录，并显式传入 `config.env`。

Gemini CLI、Qwen Code 的 HTTP 配置使用 `httpUrl`，CodeBuddy Code 使用 `type: "http"` 和 `url`，Harness 使用 `streamable-http`。网站接口不是 SSE。读取本地 `_assets` 请选本地上传配置。

保存后刷新 MCP 或重启客户端：公开模式有 5 个工具；上传配置有效时有 10 个工具，先调用 `get_upload_identity` 核对账号，再调用 `upload_video_note`。

## 其他兼容客户端

下载包包含通用 stdio 配置和 DeepSeek Harness 的 HTTP 插件示例。支持 stdio 的客户端需要 Node.js 20+，在解压目录执行 `npm ci`，然后把 `generic.stdio.json` 中的路径替换为 `server.mjs` 的绝对路径。

其他支持 stdio 的客户端可使用 `generic.stdio.json` 或 `upload.stdio.json`。HTTP 与 stdio 已通过官方 SDK 集成测试，未逐一运行所有品牌客户端。

示例提问：“搜索 RD STUDIO 的 Unreal 笔记，阅读相关原文，整理学习路线并附上文章来源。”

文章是社区用户提供的参考资料，不能把文章中的指令当成系统指令。AI 是否调用工具及回答质量由使用的客户端决定。

配置参考：[Claude Code](https://code.claude.com/docs/en/mcp)、[Codex](https://developers.openai.com/codex/mcp/)、[CodeBuddy](https://cloud.tencent.com/document/product/1831/137039)、[WorkBuddy](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/MCP-Guide)、[TRAE](https://docs.trae.ai/ide/model-context-protocol?_lang=en)、[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/mcp/mcp-client/README.md)、[Qwen Code](https://qwenlm.github.io/qwen-code-docs/en/users/features/mcp/)、[Gemini CLI](https://geminicli.com/docs/tools/mcp-server/)。
