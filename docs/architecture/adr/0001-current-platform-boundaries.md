# ADR-0001：当前平台与安全边界

- 状态：已接受
- 日期：2026-07-10
- 决策者：RD STUDIO 项目维护者

## 背景

网站已经运行在 VitePress、Vue、Supabase 和 GitHub Pages 上。当前阶段优先修复安全与工程基线，暂不通过框架迁移扩大范围。

## 决策

1. **数据主源**：产品文章、评论、点赞、收藏、审核状态以 Supabase Postgres 为主源；Git Markdown 仅保存静态说明文档。
2. **认证方式**：用户身份使用 Supabase Auth 与 GitHub OAuth；权限最终由数据库 RLS 和服务端边界强制执行。
3. **托管平台**：站点继续由 GitHub Actions 构建并发布到 GitHub Pages；Sites skill 仅以 existing-site、capability-path、local-only 方式参与开发，不接管托管。
4. **特权操作**：`service_role`、GitHub 写入令牌等凭据只允许存在于受控服务端或 CI；浏览器只能获得 Supabase URL、公开 `anon` key 和用户会话 JWT。

## 备选方案

- 立即迁移到新的全栈托管平台：当前安全整改不依赖该迁移，成本和回归面过大。
- 继续由浏览器持有特权凭据：无法建立可信权限边界，拒绝采用。
- 用 Markdown/GitHub API 作为全部业务数据源：不适合现有认证、审核和关系数据模型。

## 影响

- 前端新增变量必须使用公开的 `VITE_` 前缀；服务端秘密禁止使用该前缀。
- GitHub Pages 构建环境需配置 `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_ANON_KEY`。
- 后续数据库、客户端和领域拆分任务必须遵守以上边界；改变任一决定需新增 ADR。
