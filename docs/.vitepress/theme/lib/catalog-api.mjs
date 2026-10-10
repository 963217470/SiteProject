export async function catalogRequest(path = '', options = {}) {
  const response = await fetch('/api/catalog' + path, {
    credentials: 'same-origin', ...options,
    headers: { 'X-RD-CSRF': '1', ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
    body: options.body ? JSON.stringify(options.body) : undefined
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw Object.assign(new Error(data.message || '请求失败，请稍后重试'), { status: response.status })
  return data
}
export async function uploadCatalogFile(file, userId) {
  if (!file.size || file.size > 100 * 1024 * 1024) throw new Error('请选择 100 MB 以内的非空文件')
  const path = userId + '/' + crypto.randomUUID() + '/' + file.name
  const response = await fetch('/api/storage/catalog/' + path.split('/').map(encodeURIComponent).join('/'), {
    method: 'POST', credentials: 'same-origin', headers: { 'X-RD-CSRF': '1', 'Content-Type': file.type || 'application/octet-stream' }, body: file
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(data.message || '上传失败')
  return { ...data, name: file.name, url: '/api/files/catalog/' + path.split('/').map(encodeURIComponent).join('/') }
}
export async function removeUnusedCatalogFiles(paths) {
  if (!paths.length) return
  const response=await fetch('/api/storage/catalog',{method:'DELETE',credentials:'same-origin',headers:{'X-RD-CSRF':'1','Content-Type':'application/json'},body:JSON.stringify({prefixes:paths})})
  const data=await response.json().catch(()=>({}))
  if (!response.ok) throw new Error(data.message || '文件清理失败')
}
