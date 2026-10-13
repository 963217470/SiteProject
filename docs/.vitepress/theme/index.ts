import DefaultTheme from 'vitepress/theme'
import Layout from './Layout.vue'
import ArticleEditor from './components/ArticleEditor.vue'
import ArticleLibrary from './components/ArticleLibrary.vue'
import TaskCenter from './components/TaskCenter.vue'
import CatalogCenter from './components/CatalogCenter.vue'
import CommentThread from './components/CommentThread.vue'
import CommentModeration from './components/CommentModeration.vue'
import MessageInbox from './components/MessageInbox.vue'
import KnowledgeExplorer from './components/KnowledgeExplorer.vue'
import AboutCommunity from './components/AboutCommunity.vue'
import './community.css'
import './custom.css'
import './ui.css'
import './tasks.css'
import './catalog.css'
import './redesign.css'
import './youthful.css'
import './article-badges.css'
import './article-community.css'
import 'katex/dist/katex.min.css'
import type { Theme } from 'vitepress'

export default {
  extends: DefaultTheme,
  Layout,
  async enhanceApp({ app }) {
    app.component('ArticleEditor', ArticleEditor)
    app.component('ArticleLibrary', ArticleLibrary)
    app.component('TaskCenter', TaskCenter)
    app.component('CatalogCenter', CatalogCenter)
    app.component('CommentThread', CommentThread)
    app.component('CommentModeration', CommentModeration)
    app.component('MessageInbox', MessageInbox)
    app.component('KnowledgeExplorer', KnowledgeExplorer)
    app.component('AboutCommunity', AboutCommunity)
    if (typeof window !== 'undefined') {
      if (!window.__api) await import('../../public/api-client.js')
      app.config.globalProperties.$supabase = window.__api
    }
  }
} satisfies Theme
