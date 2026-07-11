# Supabase 目录

## 当前状态

本目录根部的 SQL 是历史人工执行脚本。后续迁移完成前保留原路径，避免现有文档和部署流程失效；它们不代表一个可从零重建的完整数据库。

## 目标结构

- `migrations/`：按顺序执行、可审查的数据库迁移。
- `functions/`：确有必要的服务端特权操作；秘密只存在于服务端环境。
- `tests/`：RLS、约束、触发器和迁移验证。

迁移工作按 `DevPlan/02-数据库迁移.md` 执行。在完整基线迁移和验证完成前，不移动或删除根部旧 SQL。

## 当前迁移顺序

1. `202607100000_profiles_baseline.sql`：创建用户资料、角色约束、新用户触发器与 RLS。
2. `202607100002_articles_baseline.sql`：创建文章、审核字段、状态/可见性约束与 RLS。
3. `202607100003_article_interactions_baseline.sql`：创建点赞、收藏、评论、唯一约束与 RLS。
4. `202607100004_atomic_interaction_counts.sql`：由数据库触发器原子维护点赞数和评论数。
5. `202607100005_knowledge_base.sql`：创建知识分支、分支申请、文章关联与审批权限。
6. `202607100006_internal_resources.sql`：创建资源元数据、私有 bucket、文件边界与 Storage RLS。
7. `202607100007_profile_review.sql`：创建资料变更申请与原子审批函数。
8. `202607109999_security_hardening.sql`：在全部基线表之上收紧文章、互动和内部资源权限。

数据库测试脚本位于 `tests/`，只允许对临时 Supabase/Postgres 环境执行；脚本使用事务并在结束时回滚。

## 从零启动

1. 启动 Docker Desktop。
2. 在仓库根目录安装依赖：`npm ci`。
3. 首次启动核心 Supabase 服务：

```powershell
npx supabase start -x studio,imgproxy,edge-runtime,logflare,vector,realtime,storage-api
```

4. 从空库执行全部迁移和数据库测试：

```powershell
npm run test:db
```

需要知识库初始分类时，显式启用可选 seed：

```powershell
npx supabase db reset --local --sql-paths ./seed.example.sql
```

默认重置不执行 seed，避免测试依赖示例内容。完成测试后可运行 `npx supabase stop` 停止本地服务。CLI 输出的本地密钥只能用于开发环境，不得复制到生产配置或提交到仓库。

## 初始化管理员

先通过 Auth 注册目标账号，再从 Dashboard 或受控的 PostgreSQL 管理连接执行：

```sql
update public.profiles
set role = 'admin'
where id = '<auth.users 中的目标 UUID>';
```

执行后必须确认只影响一行。普通浏览器会被 `protect_profile_role` 触发器拒绝，不能用前端会话初始化管理员。生产环境执行前需备份数据库并记录 Git 提交与迁移版本。

## 生产迁移边界

- `supabase/migrations/` 是唯一迁移入口，按文件名顺序执行；根目录 SQL 仅为迁移完成前保留的历史兼容脚本。
- 不对生产项目运行 `db reset` 或测试脚本；生产只使用受审查的增量迁移。
- `DB-001` 的生产 Schema 快照完成前，必须先在生产备份或 staging 副本验证迁移，处理现有约束、重复 username 和历史互动数据。
