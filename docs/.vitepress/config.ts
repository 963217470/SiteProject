import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'RD STUDIO',
  description: '创造 · 学习 · 分享',
  base: '/SiteProject/',

  head: [
    ['script', { src: '/SiteProject/supabase-rest.js' }],
    ['script', { src: '/SiteProject/profile-page.js' }]
  ],

  vite: {
    optimizeDeps: {
      include: ['@vueuse/core', 'vue', '@vueuse/integrations/useFocusTrap']
    },
    server: {
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
