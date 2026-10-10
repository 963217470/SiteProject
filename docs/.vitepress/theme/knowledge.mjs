export function knowledgeModel(branches, articles) {
  const map = new Map(branches.map(b => [b.id, b]))
  const path = id => {
    const names = [], seen = new Set()
    while (map.has(id) && !seen.has(id)) { seen.add(id); const b = map.get(id); names.unshift(b.name); id = b.parent_id }
    return names.join(' / ')
  }
  const nodes = [{ id: 'root', label: '知识库', kind: 'root', parent: '', path: '全部分支' }]
  for (const b of branches) {
    // Malformed legacy hierarchies remain reachable without creating cyclic graph edges.
    let ancestor = b.parent_id, cyclic = ancestor === b.id
    const seen = new Set([b.id])
    while (map.has(ancestor) && !cyclic) { if (seen.has(ancestor)) { cyclic = true; break }; seen.add(ancestor); ancestor = map.get(ancestor).parent_id }
    nodes.push({ ...b, id: 'b:' + b.id, label: b.name, kind: 'branch', parent: !cyclic && map.has(b.parent_id) ? 'b:' + b.parent_id : 'root', path: path(b.id), sourceId: b.id })
  }
  for (const a of articles) nodes.push({ ...a, id: 'a:' + a.id, label: a.title, kind: 'article', parent: map.has(a.kb_branch_id) ? 'b:' + a.kb_branch_id : 'root', path: path(a.kb_branch_id), sourceId: a.id })
  return nodes
}

export function visibleKnowledge(nodes, collapsed) {
  const map = new Map(nodes.map(n => [n.id, n]))
  return nodes.filter(n => {
    let parent = n.parent; const seen = new Set([n.id])
    while (parent && !seen.has(parent)) { if (collapsed.has(parent)) return false; seen.add(parent); parent = map.get(parent)?.parent }
    return true
  })
}

export function knowledgeDescendants(nodes, id) {
  const result = new Set([id]), children = new Map()
  for (const n of nodes) { if (!children.has(n.parent)) children.set(n.parent, []); children.get(n.parent).push(n.id) }
  const queue = [id]
  for (let i = 0; i < queue.length; i++) for (const child of children.get(queue[i]) || []) if (!result.has(child)) { result.add(child); queue.push(child) }
  return result
}

export function resolveKnowledge(nodes, target) {
  const normalize = value => String(value || '').replace(/^知识库总览\s*\/\s*/, '').replace(/\s+/g, '').toLowerCase()
  return nodes.find(n => n.id === target || n.sourceId === target || normalize(n.path) === normalize(target) || normalize(n.label) === normalize(target)) || nodes[0]
}

export function knowledgeOutline(nodes) {
  const children=new Map(),seen=new Set(),result=[]
  for(const node of nodes){if(!children.has(node.parent))children.set(node.parent,[]);children.get(node.parent).push(node)}
  const stack=(children.get('')||[]).map(node=>({node,depth:0})).reverse()
  while(stack.length){const {node,depth}=stack.pop();if(seen.has(node.id))continue;seen.add(node.id);result.push({...node,depth});for(const child of (children.get(node.id)||[]).toReversed())stack.push({node:child,depth:depth+1})}
  return result
}
