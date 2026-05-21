import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'RD STUDIO',
  description: '创造 · 学习 · 分享',

  // 基础配置
  base: '/SiteProject/',

  head: [
    ['script', { src: '/SiteProject/supabase-rest.js' }]
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

  // 主题配置
  themeConfig: {
    // 导航栏
    nav: [
      { text: '首页', link: '/' },
      { text: '文章', link: '/articles' },
      { text: '知识库', link: '/kb' },
      { text: '内部', link: '/internal' },
      { text: '关于', link: '/about' }
    ],

    // 侧边栏
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

    // 搜索
    search: {
      provider: 'local'
    },

    // 页脚
    footer: {
      message: 'RD STUDIO',
      copyright: '© 2024 RD STUDIO'
    }
  }
})
