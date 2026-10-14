# RD STUDIO MCP v1.0.0

日期：2026-10-14

- 新增官方 MCP SDK 驱动的公开只读 Streamable HTTP 入口 `/api/mcp`。
- 提供可移植的 stdio 源码包，以及 Claude Code、Codex、DeepSeek Harness 和通用 stdio 接入示例。
- 支持公开文章标题搜索、Markdown 分段阅读、知识库分支目录和笔记查询。
- 不开放内部文章、草稿、待审核资料、账户信息或任何写入权限；不需要令牌。
- 新增真实 SDK HTTP/stdio 集成测试和来源、Host、Cookie 越权及 CSRF 回归测试。
- 发布前备份后端代码，安装依赖到独立版本目录，健康检查失败自动回滚。

源码及使用说明：`mcp/rd-studio-mcp/README.md`。现有网站登录、经验、任务、评论及内部访问规则保持不变。

## 验证与部署

- 后端 43 项测试、前端 52 项测试全部通过；生产构建成功。
- 公网官方 SDK 客户端完成初始化、工具枚举和真实查询；目前公开已发布文章列表为空，未填充模拟资料。
- 接入说明页面在 1440px / 390px 验证通过，无横向溢出；公网下载包 SHA256 与本地一致。
- 入口：`https://rd-studio.club/api/mcp`；说明与下载：`https://rd-studio.club/mcp/`。
- 后端版本：`/opt/rd-studio/releases/rd-mcp-20261014T073527Z`。
- 后端备份：`/var/backups/rd-studio/mcp-20261014T073527Z`。
- 前端版本：`/www/wwwroot/rd-studio.club/releases/rd-ui-20261014T073634Z`。
- 前端备份：`/var/backups/rd-studio/frontend-ui-20261014T073634Z`。

代码回滚时将对应 `current` 符号链接切回备份记录中的旧版本；后端切换后重启 `rd-studio` 服务。本次无数据库迁移，不需要回滚用户数据。
