# 生产 Schema 快照说明

本页记录 2026-07-12 对 Supabase 项目 `yyqhmbvnlqqqrmilhawz` 的只读盘点。结构快照位于 [`schema-snapshot.sql`](./schema-snapshot.sql)，仅包含 `public` Schema 定义，不包含 Auth 用户、业务行、Storage 对象或任何真实秘密。

## 生成与一致性检查

```powershell
npx.cmd supabase db dump --linked --schema public --file supabase/schema-snapshot.sql
npx.cmd supabase db diff --linked --schema public
```

盘点时 `db diff` 返回空差异，说明远端 `public` Schema 与 `supabase/migrations/` 完全一致。快照是审计产物，后续结构变更仍必须通过 migration 实施，不能直接修改快照。

## 表

| 表 | 关键用途 | 前端依赖 |
|---|---|---|
| `profiles` | 用户公开资料和 `user/member/admin` 角色 | 认证、导航、个人页、后台权限 |
| `articles` | 草稿、审核、公开/内部文章和互动计数 | 首页、文章、编辑器、知识库、后台 |
| `article_likes` | 用户文章点赞明细 | 文章详情、个人统计 |
| `article_favorites` | 用户收藏明细 | 文章详情、个人页 |
| `comments` | 文章评论 | 文章详情 |
| `knowledge_branches` | 知识库树形分支 | 知识库、文章详情、后台 |
| `knowledge_branch_requests` | 文章进入知识库的申请与审核 | 文章详情、知识库后台 |
| `internal_resources` | 私有资源元数据 | 内部资源页 |
| `profile_changes` | 用户资料修改审核队列 | 个人页、资料审核后台 |

上述 9 张业务表均启用 RLS。匿名角色只获得公开文章、可见评论、公开资料和知识分支的必要读取权限；其余访问由当前用户 JWT、本人关系、成员角色或管理员角色决定。

## 函数

| 函数 | 作用 |
|---|---|
| `is_admin()` | 根据当前 `auth.uid()` 判断管理员 |
| `is_member()` | 判断社员或管理员 |
| `handle_new_user()` | Auth 用户建立后创建 profile |
| `protect_profile_role()` | 阻止非管理员修改角色 |
| `set_updated_at()` | 统一更新时间字段 |
| `apply_article_interaction_count_delta()` | 原子维护点赞/评论计数 |
| `protect_article_interaction_counts()` | 阻止客户端直接覆盖计数 |
| `review_profile_change(...)` | 原子批准或拒绝资料变更 |
| `rls_auto_enable()` | 新项目平台级自动 RLS 事件触发器 |

## 触发器

- Auth 新用户触发器：创建 `profiles`。
- 角色保护触发器：保护 `profiles.role`。
- 文章计数保护与点赞/评论增删计数触发器。
- profiles、articles、comments、knowledge、resources、profile_changes 的 `updated_at` 触发器。

## 索引与约束

- 点赞和收藏使用 `(article_id, user_id)` 唯一约束，禁止重复记录。
- profiles 用户名使用不区分大小写的唯一索引。
- 文章按作者/状态/创建时间及状态/可见性/创建时间建立复合索引。
- 评论、知识库申请、内部资源和资料审核均覆盖主要过滤与排序路径。
- 文章状态、可见性、角色、审核状态和资源状态均有 check 约束。

完整名称、列、外键、默认值、索引、GRANT 和 policy 表达式见 SQL 快照。

## Storage

| Bucket | 可见性 | 规则 |
|---|---|---|
| `resources` | 私有 | 社员读取；管理员上传、更新和删除；单文件不超过 500 MiB |

前端个人页仍引用 `avatars` bucket，但当前 migrations 和新项目基线没有创建该 bucket。这是已识别的实现缺口：在正式启用头像上传前，应新增独立 migration，明确文件类型、大小、对象路径和本人/管理员策略，不能在控制台临时创建后不留记录。

## 前端覆盖结论

源码中的 PostgREST 查询只引用上述 9 张表，全部存在于快照。Storage 的 `resources` 依赖已覆盖；`avatars` 是唯一未被迁移覆盖的前端数据依赖。该缺口应在 profiles 领域拆分或资料审核收敛时修复。

## 安全结论

- `public` Schema 与 migrations 无漂移。
- 9 张业务表全部启用 RLS。
- 浏览器使用 Publishable key 与用户 JWT，不使用特权密钥。
- 快照不包含真实用户数据和认证秘密。
- Storage 策略不包含在 `public` dump 中，其证据来自 `202607100006_internal_resources.sql`、`202607109999_security_hardening.sql` 和对应事务测试。
