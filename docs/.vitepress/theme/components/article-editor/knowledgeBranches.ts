export interface KnowledgeBranch {
  id: string
  parent_id: string | null
  name: string
  sort_order: number | null
}

export interface FlatKnowledgeBranch extends KnowledgeBranch {
  label: string
}

export function flattenKnowledgeBranches(
  branches: KnowledgeBranch[],
  parentId: string | null = null,
  depth = 0
): FlatKnowledgeBranch[] {
  return branches
    .filter(branch => (branch.parent_id || null) === parentId)
    .sort((a, b) => (Number(a.sort_order || 0) - Number(b.sort_order || 0)) || a.name.localeCompare(b.name, 'zh-CN'))
    .flatMap(branch => {
      const prefix = depth > 0 ? '　'.repeat(depth) + '└ ' : ''
      return [
        { ...branch, label: prefix + branch.name },
        ...flattenKnowledgeBranches(branches, branch.id, depth + 1)
      ]
    })
}
