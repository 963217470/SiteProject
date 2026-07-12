import DefaultTheme from 'vitepress/theme'
import Layout from './Layout.vue'
import ArticleEditor from './components/ArticleEditor.vue'
import './custom.css'
import 'katex/dist/katex.min.css'
import type { Theme } from 'vitepress'
import { supabase } from './lib/supabase'
import { derivePermissions, normalizeRole, roleDescription, roleLabel } from './lib/permissions'
import { toAppError, toUserMessage } from './lib/errors'
import * as profilesService from './services/profiles'

if (typeof window !== 'undefined') {
  window.RDPermissions = { derivePermissions, normalizeRole, roleDescription, roleLabel }
  window.RDErrors = { toAppError, toUserMessage }
  window.RDProfiles = profilesService
  if (supabase) window.getSupabaseClient = () => supabase
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
