# RD STUDIO 开发计划

本目录是后续开发的唯一任务入口。任务按最小可交付单元拆分，每次只领取一个或一小批依赖明确的任务。

## 执行规则

- 所有任务初始状态均为 `TODO`；开始时改为 `IN PROGRESS`，完成并验证后改为 `DONE`。
- 一个任务只解决一个主要问题；若实现中出现额外需求，新增任务，不扩大当前任务范围。
- 默认保留 VitePress、Vue、Supabase 和 GitHub Pages，不迁移 Sites 托管。
- 当前不进行视觉设计。页面使用 VitePress 默认能力和最小占位界面，只保证信息、状态与操作完整。
- 涉及生产密钥、生产数据库、部署、推送或其他外部变更时，必须单独获得用户授权。
- 每批完成后至少执行 `npm run build`；权限任务还必须验证拒绝路径。
- 每个 Task 验证完成后单独创建本地 Git commit，提交信息包含 Task ID；默认禁止 push 到远程。

## 推荐批次

| 批次 | 目标 | 前置条件 | 文档 |
|---|---|---|---|
| Batch 0 | 固化目录和开发基线 | 无 | [00-工作区基线](./00-工作区基线.md) |
| Batch 1 | 安全止血 | Batch 0 | [01-安全整改](./01-安全整改.md) |
| Batch 2 | 建立可重建数据库 | Batch 1 | [02-数据库迁移](./02-数据库迁移.md) |
| Batch 3 | 统一客户端与认证 | Batch 1、2 | [03-客户端与认证](./03-客户端与认证.md) |
| Batch 4 | 按领域拆分功能 | Batch 3 | [04-领域模块](./04-领域模块.md) |
| Batch 5 | 自动化验证与部署门禁 | Batch 2、3 | [05-质量与CI](./05-质量与CI.md) |
| Batch 6 | 文档与实现收敛 | Batch 2 至 5 | [06-文档收敛](./06-文档收敛.md) |
| Later | 正式前端设计与可用性优化 | 核心功能稳定 | [07-前端后置](./07-前端后置.md) |

## 当前架构决定

- 产品文章、评论、点赞、收藏、审核状态：Supabase Postgres。
- 用户认证：Supabase Auth + GitHub OAuth。
- 内部文件：Supabase 私有 Storage。
- 静态说明文档：Git Markdown + VitePress。
- 普通数据访问：浏览器使用 `anon` key 与用户 JWT，由 RLS 授权。
- 特权操作：仅允许在受控服务端环境执行，不在浏览器保存 `service_role`。
- 部署：继续使用 GitHub Pages；Sites skill 以 existing-site、capability-path、local-only 方式参与开发。

## 目标工作区结构

```text
SiteProject/
├─ AGENTS.md                 Agent 执行规则
├─ DevPlan/                  最小任务、批次和完成状态
├─ docs/                     VitePress 页面与静态资源
│  └─ .vitepress/
│     └─ theme/
│        ├─ components/      按 common/articles/admin/profile 分域
│        ├─ composables/     Vue 状态与页面编排
│        ├─ lib/             Supabase 单例等基础设施
│        ├─ services/        领域数据访问与错误转换
│        └─ types/           数据库与领域类型
├─ supabase/
│  ├─ migrations/            版本化数据库迁移
│  ├─ functions/             必要的服务端特权操作
│  ├─ tests/                 数据库、RLS 与迁移测试
│  └─ *.sql                  迁移完成前保留的历史脚本
├─ tests/
│  ├─ unit/                  纯函数与组件逻辑测试
│  └─ permissions/           端到端权限拒绝路径
└─ .github/workflows/        CI 与 GitHub Pages 部署
```

目录骨架不等于立即迁移。运行中的文件只在对应最小任务内移动，每次移动后必须修正引用并构建验证。

## 完成标记

任务完成时使用：

```text
Status: DONE
Verified: npm run build; <其他检查>
```

不能验证时不得标记为 `DONE`，应记录具体阻塞条件。
