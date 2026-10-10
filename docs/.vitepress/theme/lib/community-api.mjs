export async function communityRequest(path, options = {}) {
  const response = await fetch('/api' + path, { credentials: 'same-origin', ...options, headers: { 'X-RD-CSRF': '1', ...(options.body ? { 'Content-Type': 'application/json' } : {}) }, body: options.body ? JSON.stringify(options.body) : undefined })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(data.message || '请求失败，请稍后重试'), { status: response.status })
  return data
}
export function rankClass(level, office) {
  if (office === 'president') return 'rank-president'
  return ({ '新人': 'rank-new', '见习社员': 'rank-apprentice', '正式社员': 'rank-member', '资深社员': 'rank-senior' })[level?.title] || 'rank-new'
}
