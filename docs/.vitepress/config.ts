import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'RD STUDIO',
  description: '创造 · 学习 · 分享',
  base: '/',
  cleanUrls: true,
  srcExclude: ['public/examples/**'],

  head: [
    ['script', { src: '/api-client.js?v=20261008-reading-history' }],
    ['script', { src: '/profile-page.js?v=20261018-profile-feed' }]
  ],

  vite: {
    optimizeDeps: {
      include: ['@vueuse/core', 'vue', '@vueuse/integrations/useFocusTrap']
    },
    server: {
      proxy: { '^/api/': { target: process.env.RD_API_DEV_URL || 'http://127.0.0.1:3100' } },
      fs: {
        allow: ['.']
      }
    }
  },

  themeConfig: {
    logo: '/images/rd-studio-logo.png',
    nav: [
      { text: '首页', link: '/', activeMatch: '^/$' },
      { text: '文章', link: '/articles', activeMatch: '^/(?:articles|article|editor)(?:/|$)' },
      { text: '知识库', link: '/kb', activeMatch: '^/(?:kb|admin/kb)(?:/|$)' },
      { text: '思维导图', link: '/mindmap/', activeMatch: '^/mindmap(?:/|$)' },
      { text: '任务', link: '/tasks', activeMatch: '^/(?:tasks|admin/tasks)(?:/|$)' },
      { text: '商城·测试', link: '/shop/', activeMatch: '^/(?:shop|admin/shop)(?:/|$)' },
      { text: '游戏/工具', link: '/games-tools/', activeMatch: '^/games-tools(?:/|$)' },
      { text: '内部', link: '/internal', activeMatch: '^/internal(?:/|$)' },
      { text: '关于', link: '/about', activeMatch: '^/about(?:/|$)' }
    ],

    sidebar: {
      '/articles/': [
        {
          text: '文章',
          items: [
            { text: '全部文章', link: '/articles' }
          ]
        }
      ],
      '/internal/': [
        {
          text: '内部文章',
          items: [
            { text: '全部内部文章', link: '/internal' }
          ]
        }
      ]
    },

    search: {
      provider: 'local'
    },

    footer: {
      message: 'RD STUDIO',
      copyright: 'Copyright 2024 RD STUDIO'
    }
  }
})
