import DefaultTheme from 'vitepress/theme'
import Layout from './Layout.vue'
import ArticleEditor from './components/ArticleEditor.vue'
import './custom.css'
import 'katex/dist/katex.min.css'
import type { Theme } from 'vitepress'

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('ArticleEditor', ArticleEditor)
    if (typeof window !== 'undefined' && window.__supabase) {
      app.config.globalProperties.$supabase = window.__supabase
    }
  }
} satisfies Theme
