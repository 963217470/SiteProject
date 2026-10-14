# MCP 多客户端接入包更新

日期：2026-10-14

- 新增 CodeBuddy、WorkBuddy、TRAE、DeepSeek Harness、千问 Qwen Code、Gemini CLI 的独立公开查询和本地笔记上传配置，共 12 个文件。
- 补充 `CLIENTS.md`，说明配置入口、路径占位符、令牌、笔记目录、工具数量和排错方式。
- Gemini CLI / Qwen Code 使用 `httpUrl`；CodeBuddy Code 使用 `type: http` 和 `url`；Harness 提供可合并的 Cordis patch，并显式传递上传令牌环境变量。
- 保留 Claude Code、Codex 和通用 stdio 接入，不改变网站接口或权限；客户端安装后仍需配置自己的路径、目录和上传令牌。
- 网站 `/mcp/` 增加客户端对照表和完整接入说明，更新公开下载压缩包。
- 普通千问 / Gemini 聊天网页的自定义 MCP 能力由产品决定，本次对应 Qwen Code / Gemini CLI。本次未在每个品牌客户端中逐一运行；标准协议已通过 HTTP 和 stdio 实际验证。

## 发布验证

- 所有 JSON 配置可正常解析。按 CodeBuddy / Qwen / Gemini 的 HTTP 字段，以及 WorkBuddy / TRAE 的 stdio 参数，通过标准 MCP SDK 连接线上服务并发现 5 个公开工具。
- 生产构建通过，桌面 1440px / 手机 390px 接入页无横向溢出；下载包 SHA256 与本地一致。
- 已部署前端版本：`/www/wwwroot/rd-studio.club/releases/rd-ui-20261014T120621Z`。
- 回档备份：`/var/backups/rd-studio/frontend-ui-20261014T120621Z`，备份校验通过。
- 后端服务和数据库本次未修改。
