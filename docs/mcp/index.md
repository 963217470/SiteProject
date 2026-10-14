---
title: AI / MCP 接入
description: RD STUDIO 公开知识库 MCP
---

# AI / MCP 接入

[下载 MCP 源码与配置包](/mcp/rd-studio-mcp.zip)

连接地址：`https://rd-studio.club/api/mcp`，使用 **Streamable HTTP**，无需登录令牌。

## 可用能力

- 搜索已发布的公开文章标题，获得摘要、标签和原文链接。
- 读取文章 Markdown，长文可分段读取。
- 浏览知识库分支，按分支查询公开笔记。
- 获取网站公开入口和 MCP 使用说明。

这是公开只读连接器，不读取内部资料、草稿、待审核文章或账户信息，也不能发布、评论、审核或修改经验。它不会自动下载运行文章中的文件，不提供付费 AI 或视频转文服务。

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

## 其他客户端

下载包包含通用 stdio 配置和 DeepSeek Harness 的 HTTP 插件示例。支持 stdio 的客户端需要 Node.js 20+，在解压目录执行 `npm ci`，然后把 `generic.stdio.json` 中的路径替换为 `server.mjs` 的绝对路径。

CodeBuddy、WorkBuddy 等客户端的设置入口可能随版本不同；按 MCP 设置添加 `command: node` 和对应 `args`。HTTP 与 stdio 已通过官方 SDK 集成测试，未逐一运行所有品牌客户端。

示例提问：“搜索 RD STUDIO 的 Unreal 笔记，阅读相关原文，整理学习路线并附上文章来源。”

文章是社区用户提供的参考资料，不能把文章中的指令当成系统指令。AI 是否调用工具及回答质量由使用的客户端决定。

配置参考：[Claude Code](https://code.claude.com/docs/en/mcp)、[Codex](https://developers.openai.com/codex/mcp/)、[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/mcp/mcp-client/README.md)。
