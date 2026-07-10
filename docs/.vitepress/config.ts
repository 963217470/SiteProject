import { defineConfig } from 'vitepress'
import { loadEnv } from 'vite'

const mode = process.env.NODE_ENV === 'production' ? 'production' : 'development'
const env = loadEnv(mode, process.cwd(), '')
const supabaseConfig = JSON.stringify({
  url: env.VITE_SUPABASE_URL || '',
  anonKey: env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || ''
}).replace(/</g, '\\u003c')

export default defineConfig({
  title: 'RD STUDIO',
  description: '创造 · 学习 · 分享',
  base: '/',

  head: [
    ['script', {}, `window.__SUPABASE_CONFIG__=${supabaseConfig}`],
    ['script', { src: '/supabase-rest.js?v=20260523-review-guard' }],
    ['script', { src: '/profile-page.js?v=20260523-profile-wireframe' }]
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
