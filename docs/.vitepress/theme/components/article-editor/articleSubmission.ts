import { createArticle, type ArticleInsert, type ArticleStatus, type ArticleVisibility } from '../../services/articles'

export interface ArticleDraft {
  title: string
  summary: string
  content: string
  visibility: ArticleVisibility
  kbEnabled: boolean
  kbBranchId: string
  kbBranchPath: string
}

interface SubmissionContext {
  article: ArticleDraft
  tags: string[]
  status: Extract<ArticleStatus, 'draft' | 'pending'>
  userId: string
  supabase: any
  hasKnowledgeBranches: boolean
  replaceInlineImages: (markdown: string) => Promise<string>
  notify: (message: string, type: 'success' | 'error' | 'info') => void
  create?: typeof createArticle
}

export type SubmissionResult =
  | { ok: true; articleId: string }
  | { ok: false; reason: 'validation' | 'database' }

export function useArticleSubmission() {
  return {
    submit: submitNewArticle,
    validate: validateArticleDraft
  }
}

export function normalizeBranchPath(value: string) {
  return String(value || '')
    .split('/')
    .map(part => part.trim())
    .filter(Boolean)
    .filter(part => part !== '知识库总览')
    .join('/')
}

export function buildArticleSummary(content: string) {
  return content
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[#>*_`-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

export function validateArticleDraft(article: ArticleDraft) {
  if (!article.title.trim()) return '请输入标题'
  if (!article.content.trim()) return '请输入内容'

  const requestedBranchPath = normalizeBranchPath(article.kbBranchPath)
  if (article.visibility !== 'internal' && article.kbEnabled && !article.kbBranchId && !requestedBranchPath) {
    return '请选择已有知识库分支，或输入要申请的新分支路径'
  }

  return ''
}

export async function submitNewArticle(context: SubmissionContext): Promise<SubmissionResult> {
  const { article, notify, status } = context
  const validationError = validateArticleDraft(article)
  if (validationError) {
    notify(validationError, 'error')
    return { ok: false, reason: 'validation' }
  }

  const requestedBranchPath = normalizeBranchPath(article.kbBranchPath)
  let content = article.content
  if (/!\[[^\]]*\]\(data:image\//i.test(content)) {
    notify('正在将内嵌图片转为线上图片...', 'info')
    content = await context.replaceInlineImages(content)
    article.content = content
  }

  const articleData: ArticleInsert = {
    title: article.title.trim(),
    summary: article.summary.trim() || buildArticleSummary(content),
    content,
    tags: context.tags,
    visibility: article.visibility,
    status,
    author_id: context.userId
  }

  if (article.visibility !== 'internal' && (article.kbEnabled || context.hasKnowledgeBranches)) {
    articleData.kb_enabled = article.kbEnabled && !requestedBranchPath
    articleData.kb_branch_id = article.kbEnabled ? article.kbBranchId || null : null
  }

  const insertedArticle = await (context.create || createArticle)(articleData)
  if (!insertedArticle?.id) {
    notify('保存失败：数据库没有返回文章 ID', 'error')
    return { ok: false, reason: 'database' }
  }

  if (article.visibility !== 'internal' && article.kbEnabled && requestedBranchPath) {
    const requestResult = await context.supabase
      .from('knowledge_branch_requests')
      .insert({
        article_id: insertedArticle.id,
        requester_id: context.userId,
        requested_path: requestedBranchPath,
        status: 'pending'
      })
      .select('id')
      .single()

    if (requestResult.error) throw requestResult.error
  }

  return { ok: true, articleId: insertedArticle.id }
}
