# 游戏开发社团网站

基于 VitePress 的游戏开发社团网站，支持文章发布、用户认证、权限管理等功能。

## 功能特性

- 🎨 现代化的 UI 设计，支持暗色模式
- 📝 文章发布系统，支持封面图和摘要
- 🔐 用户认证系统（GitHub OAuth）
- 👥 权限管理（游客/社员/管理员）
- 🔒 内部文章访问控制
- 💬 评论和点赞功能
- 🔍 文章搜索和标签筛选

## 技术栈

- **前端框架**: VitePress + Vue 3
- **用户认证**: Supabase Auth
- **部署平台**: GitHub Pages
- **样式**: 自定义 CSS

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 为 `.env`，并填入实际的值：

```bash
cp .env.example .env
```

### 3. 启动开发服务器

```bash
npm run dev
```

### 4. 构建生产版本

```bash
npm run build
```

## 项目结构

```
├── docs/
│   ├── .vitepress/
│   │   ├── config.ts          # VitePress 配置
│   │   └── theme/
│   │       ├── index.ts       # 主题配置
│   │       ├── custom.css     # 自定义样式
│   │       └── composables/
│   │           └── useSupabase.ts  # Supabase 集成
│   ├── articles/              # 公开文章
│   ├── internal/              # 内部文章
│   ├── user/                  # 用户页面
│   ├── admin/                 # 管理后台
│   └── index.md              # 首页
├── .github/workflows/
│   └── deploy.yml            # GitHub Actions 部署配置
├── package.json
└── README.md
```

## 部署

推送到 GitHub 仓库后，GitHub Actions 会自动构建并部署到 GitHub Pages。

### 启用 GitHub Pages

1. 进入仓库 Settings -> Pages
2. Source 选择 "GitHub Actions"
3. 推送代码后会自动部署

## 环境变量

| 变量名 | 说明 |
|--------|------|
| `VITE_SUPABASE_URL` | Supabase 项目 URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 推荐的 Supabase 公开密钥，可进入浏览器构建产物 |
| `VITE_SUPABASE_ANON_KEY` | 旧项目临时兼容的公开匿名密钥，迁移后删除 |
| `SUPABASE_SECRET_KEY` | 推荐的服务端特权密钥，仅限受控服务端秘密存储 |
| `SUPABASE_SERVICE_ROLE_KEY` | 旧服务端临时兼容项，轮换后禁用并删除 |
| `GITHUB_WRITE_TOKEN` | 仅限受控服务端或 CI 使用，禁止使用 `VITE_` 前缀 |

## 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 创建 Pull Request

## 许可证

ISC License
