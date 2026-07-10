# Supabase 安全操作手册

## 应用顺序

1. 在隔离数据库按顺序执行 `migrations/`，再运行 `tests/security_hardening.sql`。
2. 生产变更前备份数据库，并记录当前 Git 提交与迁移版本。
3. 基线迁移全部完成并验证后，将 `202607109999_security_hardening.sql` 应用于生产数据库。
4. 为 GitHub Pages 配置 `VITE_SUPABASE_URL` 与 `VITE_SUPABASE_PUBLISHABLE_KEY`，确认登录、普通用户、社员和管理员路径。
5. 完成下述密钥轮换；不要把新秘密复制到仓库、浏览器变量或聊天记录。

## 泄露密钥轮换

Supabase 当前推荐从旧 JWT 型 `anon/service_role` 迁移到 `sb_publishable_` 与 `sb_secret_`。新建密钥不会自动使旧密钥失效，因此必须完成最后的禁用步骤。

1. 在 Dashboard 的 **Settings → API Keys** 创建 publishable key 和按服务拆分的 secret key。
2. 浏览器只配置 publishable key；受控服务端才可配置 secret key。
3. 验证所有客户端均已切换后，在 Legacy API Keys 中禁用旧 `anon` 与 `service_role`。
4. 使用已泄露的旧 `service_role` 对一个只读 Data API 端点发起请求，必须返回 `401`；不要在终端输出完整密钥。
5. 检查 Auth、Edge Functions、数据库 Webhooks 和其他集成，确认没有继续依赖旧 JWT 型密钥。

如果项目仍使用旧 JWT signing secret，应按 Dashboard 的 JWT Signing Keys 流程迁移/轮换，并明确撤销 previously used key；只创建新 key 不算完成轮换。

官方依据：

- <https://supabase.com/docs/guides/getting-started/api-keys>
- <https://supabase.com/docs/guides/getting-started/migrating-to-new-api-keys>
- <https://supabase.com/docs/guides/troubleshooting/rotating-anon-service-and-jwt-secrets-1Jq6yd>
