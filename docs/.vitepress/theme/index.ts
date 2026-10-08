import DefaultTheme from 'vitepress/theme'
import Layout from './Layout.vue'
import ArticleEditor from './components/ArticleEditor.vue'
import ArticleLibrary from './components/ArticleLibrary.vue'
import './custom.css'
import './ui.css'
import 'katex/dist/katex.min.css'
import type { Theme } from 'vitepress'

export default {
  extends: DefaultTheme,
  Layout,
  async enhanceApp({ app }) {
    app.component('ArticleEditor', ArticleEditor)
    app.component('ArticleLibrary', ArticleLibrary)
    if (typeof window !== 'undefined') {
      if (!window.__api) await import('../../public/api-client.js')
      app.config.globalProperties.$supabase = window.__api
    }
  }
} satisfies Theme
