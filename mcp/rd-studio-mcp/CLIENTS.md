# AI 客户端接入

核对日期：2026-10-14。所有客户端使用同一个 RD STUDIO 服务，查询权限与草稿上传权限一致。

## 选择配置

| 客户端 | 公开查询配置 | V2md 本地笔记上传配置 | 配置入口 |
| --- | --- | --- | --- |
| CodeBuddy Code / IDE | `codebuddy.http.json`（Code）；IDE 也可用 `generic.stdio.json` | `codebuddy.upload.stdio.json` | Code 用户级 `~/.codebuddy/.mcp.json`；IDE 设置中的 MCP 配置编辑器 |
| WorkBuddy | `workbuddy.stdio.json` | `workbuddy.upload.stdio.json` | 插件 → MCP 服务器 → 配置 MCP；用户级 `~/.workbuddy/mcp.json` |
| TRAE（trea） | `trae.stdio.json` | `trae.upload.stdio.json` | MCP 设置 → 手动添加；使用命令、参数、环境变量配置 |
| DeepSeek Harness | `deepseek-harness.http.patch.yaml` | `deepseek-harness.upload.patch.yaml` | 当前 profile 的 `cordis.patch.yml` |
| 千问 Qwen Code | `qwen-code.http.json` | `qwen-code.upload.stdio.json` | `~/.qwen/settings.json` 的 `mcpServers` |
| Gemini CLI | `gemini-cli.http.json` | `gemini-cli.upload.stdio.json` | `~/.gemini/settings.json` 的 `mcpServers` |
| Claude Code | `claude-code.http.json` | `upload.stdio.json` | 项目 `.mcp.json` 或客户端 MCP 配置 |
| Codex | `codex.http.toml` | `upload.stdio.json` 的 command / args / env 迁入 TOML | 用户 MCP 配置 |

千问、Gemini 在这里指支持 MCP 的 Qwen Code、Gemini CLI；普通网页聊天不一定提供自定义 MCP 入口。云端客户端只能访问其运行环境中的文件，不能直接读取你电脑上的 `_assets`。

## 安装本地连接器

在解压目录执行 `npm ci`（Node.js 20+），按表中客户端选取一个配置，合并到已有 `mcpServers`，保留其他服务器。

将 `args` 改成解压目录中 `server.mjs` 的绝对路径；Windows 使用 `C:/...` 或 `E:/...`。若 GUI 客户端找不到 `node`，将 `command` 改成 `node.exe` 的绝对路径。文件中是占位符，不能原样运行。

上传配置还需填写：

- `RD_STUDIO_UPLOAD_TOKEN`：从 [网站接入页](https://rd-studio.club/mcp/)登录后创建的本人上传令牌。
- `RD_STUDIO_NOTES_ROOT`：允许读取的笔记目录，必须包含笔记和 `_assets` 图片。

默认令牌只用于本人公开草稿与笔记图片。创建新令牌时可勾选“知识库节点写入”；上传配置中的 `RD_STUDIO_KNOWLEDGE_WRITE=1` 启用节点工具，但不能绕过服务器的令牌授权。管理员直接创建，普通账号关联自己的文章提交申请。旧令牌权限不变。不要将填写后的私人配置提交到 Git；配置不需要 GitHub OAuth Secret 或模型 API Key。

## DeepSeek Harness

先确保当前 profile 已安装与宿主版本相匹配的 `@deepseek-ai/dsh-mcp-client`。将 patch 文件的 `insert` 条目合并到当前 profile 的 `cordis.patch.yml`；默认 Web profile 通常是 `$DSH_HOME/profiles/web/cordis.patch.yml`。已有 `insert` 列表可以追加行，不要替换整个文件。

`deepseek-harness.http.yaml` 是直接插件列表条目，供要求插件列表的配置使用；带 `.patch.yaml` 的文件才是 Cordis patch 格式，两者不要混用。

上传 patch 显式传递 `RD_STUDIO_UPLOAD_TOKEN`、`RD_STUDIO_NOTES_ROOT`，从启动 Harness 的环境中读取。Harness 会过滤继承环境中的令牌变量，只在系统中设置变量而不在 `config.env` 中传递，连接器无法收到它。`!!js process.env...` 是 Harness 原生配置语法，不要当作普通 YAML 工具执行代码。

保存后刷新 MCP 或重启客户端。在 Harness 中工具会带 `mcp__rd_studio_upload__` 前缀，其他客户端也可能添加自己的命名空间。

## 远程 HTTP

公开查询不需要令牌。Gemini CLI 和 Qwen Code 使用 `httpUrl`；CodeBuddy Code 使用 `type: "http"` 与 `url`；Harness 使用 `transport: streamable-http`。不要将网站接口配成 SSE。

远程客户端上传已准备的 Markdown / Base64 图片，需要在客户端提供的 HTTP 请求头设置中加入 `Authorization: Bearer <本人上传令牌>`。默认提供 11 个工具，授权节点写入后 12 个，但没有读取本地文件的 `upload_video_note`。本地 stdio 默认上传 12 个工具，设置 `RD_STUDIO_KNOWLEDGE_WRITE=1` 后 13 个；调用节点工具前确认令牌已授权。

以上客户端的上传配置同时提供 `save_mindmap_draft` 和 `import_text_draft`。前者将节点树保存为导图草稿，后者将完整纯文本或 Markdown 导入文章草稿。都需先确认身份，不会直接发布。示例及限制见 `README.md`。本地连接器请升级到 v1.4.0，HTTP 客户端刷新工具列表即可。

## 验证与常见问题

- 公开模式应发现 5 个工具。可提问：“查询 RD STUDIO 网站信息，再搜索一篇 Unreal 笔记。”
- 上传模式先调用 `get_upload_identity` 确认账号，再让 AI 使用 `upload_video_note` 上传笔记。返回草稿链接后在网站检查并提交审核。
- 只有 5 个工具：上传令牌没有传入子进程，检查 `env` 或刷新连接。
- 401：令牌占位符未替换、已过期或被撤销。请在网站重新创建。
- 本地路径失败：确认文件处于 `RD_STUDIO_NOTES_ROOT` 内，并检查 Node 和程序的绝对路径。
- 网页直接访问 `/api/mcp` 显示 405：该地址供 MCP 客户端 POST 连接，不是网页。

已通过标准 MCP SDK 验证 HTTP 和 stdio，以及真实笔记上传；未逐一启动所有品牌客户端。不同版本的设置入口以当前客户端为准。

## 官方资料

- [CodeBuddy MCP](https://cloud.tencent.com/document/product/1831/137039)
- [CodeBuddy IDE MCP](https://cloud.tencent.com/document/product/1831/137461)
- [WorkBuddy MCP](https://www.codebuddy.cn/docs/workbuddy/From-Beginner-to-Expert-Guide/Function-Description/MCP-Guide)
- [TRAE MCP](https://docs.trae.ai/ide/model-context-protocol?_lang=en)
- [DeepSeek Harness MCP 插件](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/mcp/mcp-client/README.md)
- [Qwen Code MCP](https://qwenlm.github.io/qwen-code-docs/en/users/features/mcp/)
- [Gemini CLI MCP](https://geminicli.com/docs/tools/mcp-server/)
