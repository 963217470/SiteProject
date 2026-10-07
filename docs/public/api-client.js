;(function() {
  const root = '/api'
  const listeners = new Set()
  // Discard sessions issued by the previous cloud backend.
  localStorage.removeItem('sb-auth-token')

  async function request(path, options = {}) {
    const headers = { ...options.headers }
    if (options.method && options.method !== 'GET') headers['X-RD-CSRF'] = '1'
    try {
      const response = await fetch(root + path, { ...options, headers, credentials: 'same-origin' })
      const data = await response.json()
      if (!response.ok) return { data: null, error: { message: data.message || '请求失败', status: response.status }, count: null }
      const range = response.headers.get('content-range')
      return { data, error: null, count: range ? Number(range.split('/')[1]) : null }
    } catch (_error) {
      return { data: null, error: { message: '无法连接服务器，请稍后重试' }, count: null }
    }
  }
  function json(method, data) {
    return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }
  }
  function notify(event, session) { listeners.forEach(callback => callback(event, session)) }

  class Query {
    constructor(table) { this.table = table; this.params = new URLSearchParams(); this.method = 'GET' }
    select(fields = '*') { this.params.set('select', fields); return this }
    insert(body) { this.method = 'POST'; this.body = body; return this }
    update(body) { this.method = 'PATCH'; this.body = body; return this }
    delete() { this.method = 'DELETE'; return this }
    filter(column, operator, value) { this.params.set(column, operator + '.' + value); return this }
    eq(column, value) { return this.filter(column, 'eq', value) }
    neq(column, value) { return this.filter(column, 'neq', value) }
    gt(column, value) { return this.filter(column, 'gt', value) }
    gte(column, value) { return this.filter(column, 'gte', value) }
    lt(column, value) { return this.filter(column, 'lt', value) }
    lte(column, value) { return this.filter(column, 'lte', value) }
    like(column, value) { return this.filter(column, 'like', value) }
    in(column, values) { return this.filter(column, 'in', '(' + values.join(',') + ')') }
    order(column, options) { this.params.set('order', column + (options?.ascending === false ? '.desc' : '.asc')); return this }
    limit(value) { this.params.set('limit', value); return this }
    offset(value) { this.params.set('offset', value); return this }
    single() { this.exactlyOne = true; return this }
    maybeSingle() { this.atMostOne = true; return this }
    selectCount() { this.count = true; return this }
    useServiceRole() { return this }
    async execute() {
      const options = this.method === 'GET' ? {} : json(this.method, this.body)
      if (this.count) options.headers = { ...options.headers, Prefer: 'count=exact' }
      const result = await request('/data/' + encodeURIComponent(this.table) + '?' + this.params, options)
      if (!result.error && (this.exactlyOne || this.atMostOne)) {
        const rows = result.data || []
        if (rows.length > 1 || (this.exactlyOne && rows.length !== 1)) return { data: null, error: { message: '没有找到唯一记录' } }
        result.data = rows[0] || null
      }
      return result
    }
    then(resolve, reject) { return this.execute().then(resolve, reject) }
    catch(reject) { return this.execute().catch(reject) }
  }

  const client = {
    auth: {
      getSession: () => request('/auth/session'),
      async getUser() {
        const result = await request('/auth/session')
        return { data: { user: result.data?.session?.user || null }, error: result.error }
      },
      onAuthStateChange(callback) {
        listeners.add(callback)
        request('/auth/session').then(result => callback('INITIAL_SESSION', result.data?.session || null))
        return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } }
      },
      async signOut() {
        const result = await request('/auth/logout', json('POST', {}))
        if (!result.error) notify('SIGNED_OUT', null)
        return result
      },
      async signInWithOAuth(options) {
        if (options.provider !== 'github') return { data: null, error: { message: '登录方式不支持' } }
        const result = await request('/auth/settings')
        if (result.error) return result
        if (!result.data.github) return { data: null, error: { message: 'GitHub 登录暂不可用' } }
        window.location.href = root + '/auth/github'
        return { data: { url: root + '/auth/github' }, error: null }
      }
    },
    from: table => new Query(table),
    storage: {
      from: bucket => ({
        upload: (path, file) => request('/storage/' + encodeURIComponent(bucket) + '/' + path.split('/').map(encodeURIComponent).join('/'), {
          method: 'POST', headers: { 'Content-Type': file.type || 'application/octet-stream' }, body: file
        }),
        getPublicUrl: path => ({ data: { publicUrl: window.location.origin + root + '/files/' + encodeURIComponent(bucket) + '/' + path.split('/').map(encodeURIComponent).join('/') } }),
        remove: paths => request('/storage/' + encodeURIComponent(bucket), json('DELETE', { prefixes: paths }))
      })
    }
  }
  window.__api = client
  // Preserve the existing page contract while all requests use the local server.
  window.__supabase = client
})()
