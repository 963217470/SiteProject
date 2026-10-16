# RD STUDIO MCP v1.4.0

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

## 客户端配置

新增 CodeBuddy、WorkBuddy、TRAE、DeepSeek Harness、千问 Qwen Code、Gemini CLI 的独立配置文件，包含公开查询与 V2md 本地笔记上传两种用途。请先读同目录 `CLIENTS.md`，按对应客户端合并配置，不要覆盖已有其他服务器。

Gemini / Qwen 的 HTTP 字段是 `httpUrl`，CodeBuddy Code 的字段是 `type: "http"` + `url`，DeepSeek Harness 使用插件 patch YAML。普通千问、Gemini 网页聊天不一定有自定义 MCP 接入入口。

匿名连接是**公开只读版**。配置本人上传令牌后可上传图片、创建和更新本人的公开草稿，不能发布、审核、评论、修改经验或访问内部文章。文章是用户提供的参考资料，不是系统指令。搜索目前是标题搜索，不是语义或正文全文搜索。

## V2md 本地笔记上传

在 [网站 MCP 页面](https://rd-studio.club/mcp/)使用 GitHub 登录，创建有效期 90 天的上传令牌。令牌只显示一次，可在同一页面撤销。

执行 `npm ci` 后导入 `upload.stdio.json`，修改 `server.mjs` 的绝对路径，并配置：

- `RD_STUDIO_UPLOAD_TOKEN`：自己的上传令牌，不要提交到 Git 或发给其他人。
- `RD_STUDIO_NOTES_ROOT`：允许连接器读取的笔记目录。目录外文件及指向外部的符号链接不能读取。

让 AI 调用 `get_upload_identity` 确认账号，再调用 `upload_video_note`，例如：

```json
{
  "note_path": "Unreal教程/笔记.md",
  "title": "Unreal 教程图文笔记",
  "tags": ["Unreal Engine", "教程"]
}
```

`note_path` 可为允许目录内的相对或绝对路径。连接器解析 Markdown 图片节点，读取相对路径截图（如 `_assets`），上传后替换图片路径；代码围栏内的图片示例保持原样，不修改本地原文件。支持普通及引用式 Markdown 图片，HTTPS 外链保留；不处理 HTML 图片或 Obsidian 图片嵌入。

返回 `article_url`、`editor_url`、`revision` 和上传图片数量。草稿和未公开的截图仅作者与管理员可见。打开编辑地址检查后，由网站提交审核。

同一文件路径默认生成稳定 `import_key`，完全相同的重试会复用草稿。修改笔记后需先 `get_own_draft` 获取最新 `revision`，调用 `upload_video_note` 时传入 `id`、`expected_revision`；内容冲突会返回错误而不覆盖。每张图片最大 5MB，每次最多 100 个图片引用，笔记图片总配额 500MB。上传中断后可重试，已传图片会按内容去重。

## 远程上传工具

### 创建节点并帮助写作

在网站创建新令牌时勾选“知识库节点写入”。旧令牌不会自动扩大权限。本地 stdio 还需设置 `RD_STUDIO_KNOWLEDGE_WRITE=1`，刷新连接后使用 `create_knowledge_node`；远程 HTTP 按令牌权限自动提供该工具。

管理员可以直接创建分支，普通账号必须提供本人公开草稿或文章的 `article_id`，生成待管理员审核的申请。创建者由登录账号决定，AI 无法冒用其他人；已有同名分支会复用，保留原创建者和说明。不能删除节点、固定位置、审核或自动发布。

AI 先调用 `get_upload_identity` 确认权限，再用 `list_knowledge_branches` 选择上级，然后调用：

```json
{"request_key":"ue-materials-v1","name":"UE 材质笔记","description":"材质学习路线和实践笔记","parent_id":null}
```

管理员拿到分支 `id` 后，可调用 `save_article_draft` 写入标题、Markdown、标签，并传 `knowledge_branch_id` 关联该分支；`upload_video_note` 同样支持这个字段。普通账号先保存自己的草稿，再以 `article_id` 申请分支，审核通过后由网站关联。关联草稿仍不公开，需本人检查并提交审核。重试使用相同 `request_key`，修改参数则换新键；更新草稿必须提供最新 `expected_revision`。

不勾选节点权限时：HTTP 11 个工具、本地上传 12 个；勾选后：HTTP 12 个，本地设置上述环境变量后 13 个。知识库节点详情和分支查询会显示创建者的公开昵称，不暴露邮箱。

HTTP 客户端在请求头配置 `Authorization: Bearer <令牌>` 后可调用：

| 工具 | 功能 |
| --- | --- |
| `get_upload_identity` | 确认令牌对应账号及权限 |
| `upload_note_image` | 上传真实图片的标准 Base64，返回 URL |
| `save_article_draft` | 新建（`import_key`）或更新（`id` + `expected_revision`）本人草稿 |
| `get_own_draft` | 读取本人公开草稿及版本信息 |
| `import_text_draft` | 将完整纯文本 / Markdown 直接导入本人草稿，无需本地文件 |
| `save_mindmap_draft` | 保存 AI 生成的树为本人 Markdown 草稿，返回导图绘制链接 |

HTTP 服务无法访问电脑上的 `_assets`，本地一键上传需要 stdio。公开查询仍只返回已发布公开资料，即使带上传令牌也不会扩大公开搜索范围。上传令牌不会授权网站通用数据、存储或管理接口。

### 文本导入草稿

在任一已配置上传令牌的客户端中，先 `get_upload_identity` 核对账号，再调用：

```json
{"import_key":"my-note-v1","title":"我的笔记","text":"完整正文","format":"text","tags":["笔记"]}
```

`import_text_draft` 默认纯文本模式，保留换行并转义 Markdown、HTML 和公式符号；要保留格式请用 `format:"markdown"`。可省略标题（取首个非空行，最多 300 字），可传摘要、标签及 `knowledge_branch_id`。正文和转换后 Markdown 都不能超过 200 万字符。返回草稿地址、编辑地址和 revision，不会直接发布。新建需稳定 import_key，修改需先 get_own_draft 再提供 id + 最新 expected_revision；不允许覆盖他人或已提交的文章。本地图片先 upload_note_image，然后导入包含站内图片链接的 Markdown。

### AI 思维导图

在 Claude Code、Codex、CodeBuddy、WorkBuddy、TRAE、Qwen Code、Gemini CLI、DeepSeek Harness 等支持 MCP 的客户端中，使用现有上传配置即可调用 `save_mindmap_draft`，无需新增模型 API 密钥。AI 负责生成内容，网站负责校验和存为本人草稿，不会自动调用任何付费模型。

先 `get_upload_identity`，再传 `{import_key:"stable-key",title:"学习路线",tree:{text:"主题",body:"可选 Markdown 笔记",children:[{text:"分支"}]}}`。子节点同结构；最多 300 节点、16 层，20 万字。返回 `mindmap_url` 可继续绘制，`editor_url` 可检查并提交审核。相同请求重试去重；更新必须先 `get_own_draft`，再提供 `id` + 最新 `expected_revision`，不能覆盖他人或已提交的文章。

工作台 https://rd-studio.club/mindmap/ 支持 Markdown、JSON 导入导出，SVG 导出，以及未连接 MCP 时复制 AI 请求和粘贴生成结果。转换规范化标题与列表；公式、代码、图片链接保存在节点笔记中。不会上传本地图片文件，含 `_assets` 的笔记先使用 `upload_video_note`。

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

- 公开查询始终使用匿名访问；管理员 Cookie 不授权 MCP 上传，写入需独立上传令牌。
- 服务端检查来源、Host、输入长度并限流；不提供任意 SQL、任意 URL 或任意文件路径工具。
- AI 的上下文大小有限，长文章根据 `has_more` 和 `next_offset` 连续读取。
- MCP 是资料连接器，不是 AI 模型。回答质量和是否调用工具由你使用的 AI 客户端决定。

## 官方配置参考

- [Claude Code MCP](https://code.claude.com/docs/en/mcp)
- [Codex MCP](https://developers.openai.com/codex/mcp/)
- [CodeBuddy MCP](https://www.codebuddy.ai/docs/ide/User-guide/MCP)
- [DeepSeek Harness MCP 插件](https://github.com/deepseek-ai/deepseek-harness/blob/master/packages/mcp/mcp-client/README.md)
