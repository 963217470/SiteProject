export async function taskRequest(path = '', options = {}) {
  const response = await fetch('/api/tasks' + path, { credentials: 'same-origin', ...options, headers: { 'X-RD-CSRF': '1', ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }, body: options.body ? JSON.stringify(options.body) : undefined })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(data.message || '请求失败，请稍后重试'), { status: response.status })
  return data
}
export async function uploadTaskEvidence(file, userId) {
  const path = userId + '/' + crypto.randomUUID() + '/' + file.name
  const response = await fetch('/api/storage/task-evidence/' + path.split('/').map(encodeURIComponent).join('/'), { method: 'POST', credentials: 'same-origin', headers: { 'X-RD-CSRF': '1', 'Content-Type': file.type || 'application/octet-stream' }, body: file })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(result.message || '上传失败')
  return { ...result, name: file.name }
}

export async function removeTaskEvidence(path) {
  const response = await fetch('/api/storage/task-evidence', { method: 'DELETE', credentials: 'same-origin', headers: { 'X-RD-CSRF': '1', 'Content-Type': 'application/json' }, body: JSON.stringify({ prefixes: [path] }) })
  if (!response.ok) throw new Error('未能清理未提交的文件，请稍后重试')
}
