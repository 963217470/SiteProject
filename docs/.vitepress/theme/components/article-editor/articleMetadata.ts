export interface ImportedArticleMetadata {
  title?: string
  summary?: string
  visibility?: 'public' | 'internal'
  tags?: string[]
  [key: string]: string | string[] | undefined
}

export function parseArticleFrontmatter(text: string): { data: ImportedArticleMetadata; content: string } {
  const data: ImportedArticleMetadata = {}
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!match) return { data, content: text }

  for (const line of match[1].split('\n')) {
    const item = line.match(/^([\w-]+):\s*(.+)$/)
    if (!item) continue
    const key = item[1].toLowerCase()
    const rawValue = item[2].trim().replace(/^["']|["']$/g, '')
    if (key === 'tags') {
      data.tags = rawValue
        .replace(/^\[|\]$/g, '')
        .split(',')
        .map(tag => tag.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
    } else {
      data[key] = rawValue
    }
  }

  return { data, content: text.replace(/^---\n[\s\S]*?\n---\n?/, '') }
}
