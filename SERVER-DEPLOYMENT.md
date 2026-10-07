# RD STUDIO 服务器部署

站点：https://rd-studio.club/
服务器：47.108.67.83（Ubuntu 22.04 / 宝塔 Nginx）

## 路径

- 网站目录：`/www/wwwroot/rd-studio.club/current`
- 发布版本：`/www/wwwroot/rd-studio.club/releases/`
- Nginx 配置：`/www/server/panel/vhost/nginx/rd-studio.club.conf`
- 证书：`/etc/letsencrypt/live/rd-studio.club/`
- 续期后重载脚本：`/etc/letsencrypt/renewal-hooks/deploy/rd-studio-nginx.sh`

证书通过 Certbot 自动续期；HTTP 自动跳转 HTTPS。现有其他站点配置未修改。

## 本次验证

生产构建成功；产物中未发现旧 Supabase 项目地址或 service_role 密钥。
首页、文章页、知识库页、登录页、OAuth 回调和前端 API 脚本返回 HTTP 200；不存在的页面返回 404。
公网 HTTPS 返回 200，证书验证通过。

## Supabase 待完成事项

当前项目：`uulmgatzihdtbzrqaocc`。公开密钥已接入；浏览器请求只使用公开密钥和已登录用户的令牌。

- 新项目尚未启用 GitHub Auth。需要在 Supabase 配置 GitHub OAuth，Site URL 设置为 `https://rd-studio.club`，允许重定向 `https://rd-studio.club/auth/callback`。
- 只读接口检查确认缺少：`knowledge_branches`、`knowledge_branch_requests`、`internal_resources`、`article_favorites`。相关功能需要完成数据库迁移和 RLS 策略配置后验证。
- 未迁移旧项目的文章和用户数据，未变更数据库访问策略。
- 旧项目曾在前端公开 service_role 管理密钥，需要在原 Supabase 控制台轮换。

## 更新网站

本地运行 `npm run build`，检查生产产物不含管理密钥，仅上传 `docs/.vitepress/dist/` 到服务器新版本目录，原子切换 `current` 链接。不要上传 `.env`、源代码或 SSH 密码。

## GitHub 登录配置

在 GitHub Settings > Developer settings > OAuth Apps 新建网站专用 OAuth App：

- Homepage URL：`https://rd-studio.club`
- Authorization callback URL：`https://uulmgatzihdtbzrqaocc.supabase.co/auth/v1/callback`

在新 Supabase 项目的 Authentication > Sign In / Providers > GitHub 中启用 Provider，填写该 OAuth App 的 Client ID 和 Client Secret 并保存。Secret 只保存在 Supabase 后台。

在 Authentication > URL Configuration 设置：

- Site URL：`https://rd-studio.club`
- Redirect URLs：`https://rd-studio.club/auth/callback`

两处 callback 不同：GitHub 把授权结果交给 Supabase，Supabase 再把登录会话交给网站。`Unsupported provider: provider is not enabled` 表示第一步 Provider 尚未启用，修改前端地址不能解决。

## 功能验证与数据库迁移

2026-10-07 只读接口检查：articles、profiles、article_likes、comments、profile_changes 可访问；knowledge_branches、knowledge_branch_requests、internal_resources、article_favorites 返回 PGRST205，尚未暴露或未创建。

需要管理员在新项目检查并执行对应的 `supabase/knowledge-base.sql`、`supabase/internal-resources.sql` 和 `supabase/article-interactions.sql`，保留 RLS，再验证知识库、内部资源、收藏功能。不要通过公开前端密钥执行迁移。

前端回归测试：`node --test tests/supabase-rest.test.mjs`。覆盖登录跳转、过期会话刷新、认证上传、匿名上传拒绝和文章提交令牌。

当前 `.github/workflows/deploy.yml` 仍发布到 GitHub Pages。推送 Git 不会更新阿里云的 `current` 目录，阿里云更新必须通过上述服务器发布流程完成。
