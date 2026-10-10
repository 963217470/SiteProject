import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'RD STUDIO',
  description: '创造 · 学习 · 分享',
  base: '/',

  head: [
    ['script', { src: '/api-client.js?v=20261008-reading-history' }],
    ['script', { src: '/profile-page.js?v=20261010-community' }]
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
    nav: [
      { text: '首页', link: '/' },
      { text: '文章', link: '/articles' },
      { text: '知识库', link: '/kb' },
      { text: '任务', link: '/tasks' },
      { text: '游戏/工具', link: '/games-tools/' },
      { text: '内部', link: '/internal' },
      { text: '关于', link: '/about' }
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
