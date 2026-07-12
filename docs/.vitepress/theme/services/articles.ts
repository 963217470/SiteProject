import { requireSupabase } from '../lib/supabase'
import type { Database } from '../types/database'

export type Article = Database['public']['Tables']['articles']['Row']
export type ArticleInsert = Database['public']['Tables']['articles']['Insert']
export type ArticleUpdate = Database['public']['Tables']['articles']['Update']
export type ArticleStatus = Article['status']
export type ArticleVisibility = Article['visibility']

const cardFields = 'id, title, summary, cover_url, tags, status, visibility, author_id, created_at, updated_at, likes_count, comments_count, views_count, reject_reason, profiles!articles_author_id_fkey(username, avatar_url)' as const
const detailFields = 'id, title, summary, content, cover_url, tags, status, visibility, author_id, created_at, updated_at, published_at, likes_count, comments_count, views_count, reject_reason, kb_enabled, kb_branch_id, kb_sort_order, profiles!articles_author_id_fkey(username, avatar_url, bio)' as const

export async function listPublicArticles(limit?: number) {
  let query = requireSupabase().from('articles').select(cardFields)
    .eq('status', 'published').eq('visibility', 'public').order('created_at', { ascending: false })
  if (limit) query = query.limit(limit)
  const result = await query
  if (result.error) throw result.error
  return result.data || []
}

export async function listInternalArticles() {
  const result = await requireSupabase().from('articles').select(cardFields)
    .eq('status', 'published').eq('visibility', 'internal').order('created_at', { ascending: false })
  if (result.error) throw result.error
  return result.data || []
}

export async function listAuthorArticles(authorId: string) {
  const result = await requireSupabase().from('articles').select(detailFields)
    .eq('author_id', authorId).order('created_at', { ascending: false })
  if (result.error) throw result.error
  return result.data || []
}

export async function listAdminArticles() {
  const result = await requireSupabase().from('articles').select(detailFields).order('created_at', { ascending: false })
  if (result.error) throw result.error
  return result.data || []
}

export async function listKnowledgeArticles() {
  const result = await requireSupabase().from('articles').select(detailFields)
    .eq('status', 'published').eq('visibility', 'public').eq('kb_enabled', true)
    .order('kb_sort_order', { ascending: true }).order('created_at', { ascending: false })
  if (result.error) throw result.error
  return result.data || []
}

export async function getArticle(articleId: string) {
  const result = await requireSupabase().from('articles').select(detailFields).eq('id', articleId).maybeSingle()
  if (result.error) throw result.error
  return result.data
}

export async function getPublishedArticleByTitle(title: string) {
  const result = await requireSupabase().from('articles').select(detailFields)
    .eq('title', title).eq('status', 'published').order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (result.error) throw result.error
  return result.data
}

export async function getArticleCounts(articleId: string) {
  const result = await requireSupabase().from('articles').select('likes_count, comments_count, views_count').eq('id', articleId).single()
  if (result.error) throw result.error
  return result.data
}

export async function incrementViewCount(articleId: string, currentCount: number) {
  return updateArticle(articleId, { views_count: Math.max(0, currentCount) + 1 })
}

export async function getArticles(articleIds: string[]) {
  const ids = Array.from(new Set(articleIds.filter(Boolean)))
  if (!ids.length) return []
  const result = await requireSupabase().from('articles').select(cardFields).in('id', ids)
  if (result.error) throw result.error
  return result.data || []
}

export async function createArticle(article: ArticleInsert) {
  const result = await requireSupabase().from('articles').insert(article).select(detailFields).single()
  if (result.error) throw result.error
  return result.data
}

export async function updateArticle(articleId: string, changes: ArticleUpdate) {
  const result = await requireSupabase().from('articles').update(changes).eq('id', articleId).select(detailFields).single()
  if (result.error) throw result.error
  return result.data
}

export async function deleteArticle(articleId: string) {
  const result = await requireSupabase().from('articles').delete().eq('id', articleId).select('id').single()
  if (result.error) throw result.error
  return result.data
}

export function saveDraft(articleId: string, changes: ArticleUpdate = {}) {
  return updateArticle(articleId, { ...changes, status: 'draft', reject_reason: null })
}

export function submitForReview(articleId: string, changes: ArticleUpdate = {}) {
  return updateArticle(articleId, { ...changes, status: 'pending', reject_reason: null })
}

export function publishArticle(articleId: string, changes: ArticleUpdate = {}) {
  return updateArticle(articleId, { ...changes, status: 'published', reject_reason: null, published_at: new Date().toISOString() })
}

export function rejectArticle(articleId: string, rejectReason: string) {
  return updateArticle(articleId, { status: 'rejected', reject_reason: rejectReason.trim() || null })
}
