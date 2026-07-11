# RD STUDIO 社团网站

RD STUDIO 是面向游戏开发社团的内容、协作与知识沉淀平台。站点使用 VitePress 1 与 Vue 3 构建前端，以 Supabase 提供 PostgreSQL、GitHub OAuth、私有文件存储和行级权限控制，通过 GitHub Actions 发布到 GitHub Pages。

> 当前仓库正在按 `DevPlan/` 分批重建。判断功能是否可以投入使用时，以 [开发计划](./DevPlan/README.md) 的 Task 状态、迁移测试和实际代码为准，不要仅依据早期方案文档。

## 核心能力

- 公开文章浏览、搜索、详情与标签信息
- GitHub OAuth 登录和统一用户会话
- 用户资料、角色及资料变更审核
- 评论、点赞、收藏与原子计数
- 文章提交、审核和知识库分支申请
- 社员内部资源与私有 Storage
- 管理员文章、知识库和用户资料审核入口
- RLS、数据库事务测试、秘密扫描和 GitHub Pages 自动发布

角色分为普通用户、社员和管理员。前端只负责展示与操作提示，最终权限由 Supabase RLS、数据库函数和受控服务端边界强制执行。

## 快速开始

要求：Node.js 22、npm；数据库开发还需要 Docker Desktop 与 Supabase CLI。

```powershell
npm install
Copy-Item .env.example .env.local
npm.cmd run dev
```

`.env.local` 至少填写：

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxx
```

不要把 `SUPABASE_SECRET_KEY`、`SUPABASE_SERVICE_ROLE_KEY`、数据库密码或 GitHub Client Secret 放入浏览器变量或提交到 Git。

常用检查：

```powershell
npm.cmd run check:secrets
npm.cmd run check:security
npm.cmd run build
npm.cmd run test:db
```

## 仓库结构

```text
SiteProject/
├─ DevPlan/                     最小 Task、批次、状态与验证记录
├─ docs/                        VitePress 页面和项目文档
│  ├─ README.md                 文档总入口
│  ├─ 项目白皮书.md             能力、架构、维护与传承说明
│  ├─ architecture/             当前架构边界与 ADR
│  └─ .vitepress/theme/         Vue 主题、组件、composable 与数据层
├─ supabase/
│  ├─ migrations/               可重放数据库迁移
│  └─ tests/                    数据、约束、触发器与 RLS 测试
├─ scripts/                     安全检查和数据库测试入口
├─ tests/                       前端/权限测试目标目录
├─ .github/workflows/           CI 与 GitHub Pages 发布
├─ AGENTS.md                    Agent 交付和安全规则
└─ .env.example                 环境变量模板，不包含真实凭据
```

## 文档入口

- [项目白皮书](./docs/项目白皮书.md)：产品定位、现状能力、技术架构、数据权限、维护、交接和路线图
- [项目文档导航](./docs/README.md)：现行文档、专题设计和历史资料的分类索引
- [当前架构边界](./docs/architecture/README.md)：代码目录职责与架构约束
- [ADR-0001](./docs/architecture/adr/0001-current-platform-boundaries.md)：平台、数据主源、认证和安全决策
- [开发计划](./DevPlan/README.md)：唯一开发任务入口
- [数据库安全说明](./supabase/SECURITY.md)：密钥、RLS 与迁移安全边界

## 维护流程

1. 从 `DevPlan/README.md` 选择满足依赖的 Task，标记为 `IN PROGRESS`。
2. 按 `AGENTS.md` 完成代码、数据库、配置、文案和相关文档。
3. 至少运行 `npm run build`；权限和数据库改动还要执行拒绝路径及 `npm run test:db`。
4. 验证后把 Task 标为 `DONE` 并记录命令和结果。
5. 每个 Task 单独创建包含 Task ID 的本地提交；未经明确授权不部署、不迁移生产库、不推送远端。

详细值班、故障处理、备份恢复与交接清单见[项目白皮书](./docs/项目白皮书.md)。

## 部署

`.github/workflows/deploy.yml` 在 `main` 分支推送或手工触发时执行：安装依赖、扫描秘密、检查安全基线、构建、扫描产物并发布 GitHub Pages。GitHub 仓库 Variables 需要配置公开的 Supabase URL 与 Publishable key；秘密不得配置为 `VITE_` 变量。

## 许可证

ISC License
