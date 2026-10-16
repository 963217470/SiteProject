# MCP 文本直接导入草稿

日期：2026-10-16。连接器版本 v1.4.0。

- 新增 `import_text_draft`：AI 可直接传 text、format、title、summary、tags、knowledge_branch_id，无需建立本地文件。
- 默认纯文本模式，转义 Markdown / HTML / 公式符号并保留换行；Markdown 模式保留正文排版。可省略标题，取首个非空行。
- 复用本人草稿的身份、审核、图片权限、稳定 import_key 去重及 expected_revision 冲突保护。没有发布、审核或修改他人的权限。
- HTTP 与 stdio 均支持；公开匿名工具仍为五个。上传默认 HTTP 11 / stdio 12，启用知识库节点权限后 HTTP 12 / stdio 13。
- 更新网站说明、各 AI 客户端接入说明及下载包。本地连接器重新下载更新，HTTP 客户端刷新工具列表。
- 集成测试覆盖真实 HTTP / stdio 调用、文本转义、Markdown 保留、重复导入、冲突、身份隔离及禁止直接发布。
- 本次联合回归：前端 105 项、后端 74 项测试通过，静态构建通过。完整渲染器测试验证纯文本中的括号、公式定界符、注释、表情短码和缩进不会意外变成排版或丢失内容。

## 部署与回滚

- 后端发布目录：`/opt/rd-studio/releases/rd-text-profile-20261016T121549Z`。
- 代码 / 数据库备份：`/var/backups/rd-studio/text-profile-20261016T121549Z`。
- 前端备份：`/var/backups/rd-studio/frontend-ui-20261016T121554Z`。
- 与管理员资料免审同批部署；生产只读校验通过，没有在生产环境导入测试草稿。
