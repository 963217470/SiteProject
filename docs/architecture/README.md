# 工作区架构

本页定义代码放置边界。目录骨架先固定，运行中的文件只在对应最小任务内迁移。

| 目录 | 职责 | 不应包含 |
|---|---|---|
| `.vitepress/theme/lib/` | Supabase 单例、通用基础设施 | 具体页面业务查询 |
| `.vitepress/theme/services/` | 按领域组织的数据访问与错误转换 | Vue 页面状态与展示逻辑 |
| `.vitepress/theme/types/` | 数据库生成类型和共享领域类型 | 运行时代码 |
| `.vitepress/theme/components/common/` | 跨领域复用的最小组件 | 文章、审核等领域流程 |
| `.vitepress/theme/components/articles/` | 文章、评论、点赞、收藏组件 | 管理员专属流程 |
| `.vitepress/theme/components/admin/` | 审核和管理组件 | 普通用户资料流程 |
| `.vitepress/theme/components/profile/` | 用户资料组件 | 全局基础设施 |
| `supabase/migrations/` | 有顺序、可审查、可重放的数据库迁移 | 临时人工修复脚本 |
| `supabase/functions/` | 必须在服务端执行的特权操作 | 浏览器代码和公开密钥 |
| `supabase/tests/` | 迁移、约束、触发器和 RLS 测试 | 前端组件测试 |
| `tests/unit/` | 纯函数与组件逻辑测试 | 真实生产凭据 |
| `tests/permissions/` | 端到端权限允许与拒绝路径 | 仅靠 UI 隐藏的权限判断 |

架构决策从 [`ADR-0001`](./adr/0001-current-platform-boundaries.md) 开始。新增重大架构选择时先复制 [`ADR 模板`](./adr/0000-template.md) 并分配连续编号。
