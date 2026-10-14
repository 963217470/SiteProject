# MCP 知识库写入更新

日期：2026-10-15。连接器版本：1.2.0。数据库版本：8。

- 新增 `create_knowledge_node`：管理员直接创建分支，普通账号提交关联本人文章的审核申请。
- 上传令牌新增可选的知识库节点权限，旧令牌默认不授权；匿名查询保持只读。
- 节点创建者绑定真实账号，知识库详情与 MCP 分支查询显示公开昵称。
- AI 可写入关联知识库分支的 Markdown 草稿，保留公式、代码、图片，不自动发布。
- 稳定请求键防止重复创建，草稿更新仍使用版本冲突检查；复用分支不修改原作者。
- 更新 CodeBuddy、WorkBuddy、TRAE、DeepSeek Harness、Qwen Code、Gemini CLI 配置与操作说明。

验证：后端 58 项、前端 78 项测试通过；真实 SDK HTTP/stdio 调用覆盖权限、创建、写稿、重试和伪造创建者防护。Edge 验证电脑与手机端创建者显示、无页面错误和横向溢出；生产 MCP 创建测试节点和未发布草稿成功，临时授权已撤销。

生产测试节点：https://rd-studio.club/kb/?branch=67b40cb4-3c8d-4fd7-91b1-39febd0c16c5

测试草稿（作者登录后可编辑）：https://rd-studio.club/editor?id=0afb7b1c-987b-415d-a56c-c493fee05647

上线前快照：

- 代码和数据库：`/var/backups/rd-studio/mcp-knowledge-20261014T164617Z`。
- 静态网站：`/var/backups/rd-studio/frontend-ui-20261014T164636Z`。
- 快照文件校验通过；迁移到版本 8 后旧令牌未获得节点写入权限。
