# 七、MCP Server 设计（后续开发）

> ⏳ **此功能暂不实现，后续开发**

## 7.1 方案说明

搭建 MCP (Model Context Protocol) Server，让内部成员通过 Claude Code 直接读取和搜索社团文档。

## 7.2 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                     Claude Code                              │
│                         │                                     │
│                    MCP Protocol                               │
│                         │                                     │
│                         ▼                                     │
│               ┌─────────────────┐                            │
│               │   MCP Server    │                            │
│               │  (Node.js)     │                            │
│               └────────┬────────┘                            │
│                        │                                      │
│           ┌────────────┼────────────┐                        │
│           ▼            ▼            ▼                        │
│     ┌──────────┐ ┌──────────┐ ┌──────────┐                  │
│     │ 搜索文章 │ │ 获取文章 │ │ 文章统计 │                  │
│     └──────────┘ └──────────┘ └──────────┘                  │
│           │            │            │                        │
│           └────────────┼────────────┘                        │
│                        ▼                                      │
│               ┌─────────────────┐                            │
│               │  GitHub API     │                            │
│               │  (读取仓库)     │                            │
│               └─────────────────┘                            │
│                        │                                      │
│                        ▼                                      │
│               ┌─────────────────┐                            │
│               │  GitHub 仓库    │                            │
│               │  (Markdown文件) │                            │
│               └─────────────────┘                            │
└─────────────────────────────────────────────────────────────┘
```

## 7.3 MCP 工具列表

| 工具名 | 功能 | 使用场景 |
|--------|------|----------|
| `search_articles` | 搜索文章内容 | "找一下 Unity 相关的文章" |
| `get_article` | 获取指定文章 | "帮我读一下这篇文章" |
| `list_articles` | 列出文章列表 | "最近有哪些文章？" |
| `get_article_stats` | 获取文章统计 | "这篇文章有多少点赞？" |
| `get_related_articles` | 获取相关文章 | "有没有和这篇文章类似的？" |

## 7.4 使用示例

```
用户: 帮我找一下关于 Godot 引擎的教程

Claude: 我通过 MCP Server 搜索到以下 Godot 相关文章：

1. 📝 《Godot 4.0 入门教程》
   - 作者：张三
   - 分类：技术分享
   - 标签：Godot, 入门, 2D游戏
   - 点赞：128

2. 📝 《GDScript 语法详解》
   - 作者：李四
   - 分类：技术分享
   - 标签：Godot, GDScript, 进阶
   - 点赞：89

要我详细阅读哪一篇？

用户: 读一下第一篇的完整内容

Claude: [通过 MCP Server 获取文章完整内容并显示]
```

## 7.5 技术实现概览

### 项目结构

```
mcp-server/
├── src/
│   ├── index.ts          # MCP Server 入口
│   ├── tools/
│   │   ├── search.ts     # 搜索工具
│   │   ├── getArticle.ts # 获取文章
│   │   └── listArticles.ts # 列出文章
│   └── services/
│       └── github.ts     # GitHub API 服务
├── package.json
└── README.md
```

### 工具定义示例

```typescript
// src/tools/search.ts
export const searchTool = {
  name: "search_articles",
  description: "搜索社团内部文章",
  inputSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "搜索关键词"
      },
      category: {
        type: "string",
        description: "分类筛选",
        enum: ["技术分享", "作品展示", "活动通知", "公告"]
      },
      tags: {
        type: "array",
        items: { type: "string" },
        description: "标签筛选"
      }
    },
    required: ["query"]
  },
  handler: async (params) => {
    // 实现搜索逻辑
  }
}
```

## 7.6 部署方案

### 免费平台选择

| 平台 | 优势 | 限制 |
|------|------|------|
| **Railway** | 免费额度充足，部署简单 | 每月 $5 免费额度 |
| **Render** | 免费计划 | 15分钟无请求会休眠 |
| **Fly.io** | 免费额度 | 需要信用卡验证 |

### 推荐 Railway

```bash
# 安装 Railway CLI
npm install -g @railway/cli

# 登录
railway login

# 初始化项目
railway init

# 部署
railway up
```

## 7.7 社员配置

社员只需在 Claude Code 配置中添加：

```json
{
  "mcpServers": {
    "game-dev-club": {
      "url": "https://your-mcp-server.up.railway.app/mcp",
      "headers": {
        "Authorization": "Bearer YOUR_TOKEN"
      }
    }
  }
}
```

或者使用项目级配置 `.claude/settings.json`。

## 7.8 安全设计

| 安全措施 | 说明 |
|----------|------|
| Token 认证 | 每个社员有独立的访问 Token |
| 权限分级 | 用户只能搜公开文章，社员可搜全部 |
| 速率限制 | 防止滥用 |
| 日志审计 | 记录查询历史 |

## 7.9 开发计划

| 阶段 | 任务 | 预计时间 |
|------|------|----------|
| 1 | 基础 MCP Server 搭建 | 1天 |
| 2 | GitHub API 集成 | 1天 |
| 3 | 搜索功能实现 | 1天 |
| 4 | 部署与测试 | 0.5天 |
| 5 | 社员文档编写 | 0.5天 |
| **总计** | | **4天** |

---

> 📄 **相关文档**
> - [项目概述](./01-项目概述.md)
> - [部署与运维](./06-部署与运维.md)
