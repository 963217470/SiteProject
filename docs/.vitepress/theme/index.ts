import DefaultTheme from 'vitepress/theme'
import Layout from './Layout.vue'
import ArticleEditor from './components/ArticleEditor.vue'
import './custom.css'
import 'katex/dist/katex.min.css'
import type { Theme } from 'vitepress'
import { supabase } from './lib/supabase'

if (typeof window !== 'undefined' && supabase) {
  window.__supabase = supabase
}

export default {
  extends: DefaultTheme,
  Layout,
  enhanceApp({ app }) {
    app.component('ArticleEditor', ArticleEditor)
    if (supabase) {
      app.config.globalProperties.$supabase = supabase
    }
  }
} satisfies Theme
