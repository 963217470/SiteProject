# RD STUDIO MCP v1.0.0

让支持 MCP 的 AI 使用 RD STUDIO 的真实公开资料，不需要付费模型 API，也不需要网站登录令牌。

## 能做什么

| 工具 | 功能 |
| --- | --- |
| `search_articles` | 按标题关键词搜索已发布的公开文章，返回摘要、标签、网址，支持分页 |
| `get_article` | 读取公开文章的原始 Markdown，长文分段读取，保留代码、公式和图片链接 |
| `list_knowledge_branches` | 浏览知识库分支、父节点和说明，支持分页 |
| `list_knowledge_articles` | 列出进入知识库的公开笔记，按分支、标题关键词筛选 |
| `get_site_info` | 查询连接器的范围和网站入口 |

还提供 `rd-studio://guide` 使用说明资源。可以对 AI 说：“搜索 RD STUDIO 的 Unreal 笔记，读取相关文章，结合原文回答并附上文章链接。”

这是**公开只读版**：不读取内部资料、个人账号、草稿或待审核内容；不能发布、审核、评论、修改经验、下载运行文件，也不包含视频转文服务。文章是用户提供的参考资料，不是系统指令。图片、视频和文件链接不会被自动下载。搜索目前是标题搜索，不是语义或正文全文搜索。

## 方式一：远程 HTTP（推荐）

已部署后地址：`https://rd-studio.club/api/mcp`，传输类型为 **Streamable HTTP**，不是旧版 SSE。无需安装 Node.js 或提供密钥。浏览器直接打开这个协议地址会返回 405，这是正常的；AI 客户端通过 POST 连接。

Claude Code：

```sh
claude mcp add --transport http rd-studio https://rd-studio.club/api/mcp
```

也可把 `claude-code.http.json` 的条目合并到项目 `.mcp.json`，不要覆盖已有其他服务器。

Codex：把 `codex.http.toml` 的内容合并到自己的 `~/.codex/config.toml`，然后刷新 MCP 连接。

DeepSeek Harness：`deepseek-harness.http.yaml` 是 `@deepseek-ai/dsh-mcp-client` 插件条目示例，合并到该客户端版本要求的插件列表，不要直接覆盖整个 Harness 配置。

## 方式二：本地 stdio（兼容不支持 HTTP 的客户端）

需要 Node.js 20 或更高版本。在本文件所在目录运行一次：

```sh
npm ci
```

然后导入 `generic.stdio.json`，把其中的 `args` 改成你电脑上 `server.mjs` 的**绝对路径**。在 Windows 上 JSON 路径可使用 `/`。`command` 是 `node`；如果客户端找不到 Node，改成 `node.exe` 的绝对路径。客户端负责启动它，不要把这个服务当网页打开。

CodeBuddy 支持这种标准 stdio MCP 配置。WorkBuddy 等客户端中可以在 MCP 设置中添加同样的 command、args；配置入口、JSON 导入格式及 HTTP 支持取决于具体版本。并未逐一运行所有品牌客户端；这里通过官方 MCP SDK 验证了 HTTP 和 stdio 协议。

本机已经生成可直接用的配置：`mcp/configs/this-computer.stdio.json`。压缩包中的通用配置则需要替换路径。

## 安全与限制

- 所有查询只使用公开匿名访问，即使请求包含网站管理员 Cookie 也不提升权限。
- 服务端检查来源、Host、输入长度并限流；不提供任意 SQL、任意 URL 或任意文件路径工具。
- AI 的上下文大小有限，长文章根据 `has_more` 和 `next_offset` 连续读取。
- MCP 是资料连接器，不是 AI 模型。回答质量和是否调用工具由你使用的 AI 客户端决定。

## 官方配置参考

- [Claude Code MCP](https://code.claude.com/docs/en/mcp)
- [Codex MCP](https://developers.openai.com/codex/mcp/)
- [CodeBuddy MCP](https://www.codebuddy.ai/docs/ide/User-guide/MCP)
- [DeepSeek Harness MCP 插件](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/mcp/mcp-client/README.md)
