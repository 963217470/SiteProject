// Supabase REST API helper — no SDK dependency needed
;(function() {
var URL = 'https://jenrgzwwowgfqbwcozbi.supabase.co'
var KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplbnJnend3b3dnZnFid2NvemJpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODgwNjM1NCwiZXhwIjoyMDk0MzgyMzU0fQ.-qioHuE8nqf-9fhwNsJmh0fPlMSt7ysc0LtFlxulh6s'
var STORAGE_KEY = 'sb-auth-token'
var session = null
var listeners = []

function getLocalSession() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    var data = JSON.parse(raw)
    if (!data.access_token) return null
    if (data.expires_at && data.expires_at * 1000 < Date.now()) return null
    return data
  } catch (e) { return null }
}

function saveLocalSession(data) {
  if (data) localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  else localStorage.removeItem(STORAGE_KEY)
}

function parseJwt(token) {
  try {
    var parts = token.split('.')
    if (parts.length !== 3) return {}
    var payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    while (payload.length % 4) payload += '='
    return JSON.parse(decodeURIComponent(Array.prototype.map.call(atob(payload), function(c) {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    }).join('')))
  } catch (e) { return {} }
}

function makeUser(tokenData) {
  var claims = parseJwt(tokenData.access_token)
  return {
    id: claims.sub || '',
    email: claims.email || '',
    user_metadata: claims.user_metadata || {},
    app_metadata: claims.app_metadata || {},
    aud: claims.aud || ''
  }
}

async function api(path, options) {
  options = options || {}
  var headers = Object.assign({ 'apikey': KEY, 'Content-Type': 'application/json' }, options.headers || {})
  if (options.token) headers['Authorization'] = 'Bearer ' + options.token
  var res = await fetch(URL + path, {
    method: options.method || 'GET',
    headers: headers,
    body: options.body ? JSON.stringify(options.body) : undefined
  })
  var text = await res.text()
  var json = null
  try { json = JSON.parse(text) } catch (e) {}
  if (!res.ok) return { data: null, error: { message: (json && json.message) || text || 'Request failed', status: res.status } }
  return { data: json, error: null }
}

async function refreshSession(sess) {
  if (!sess || !sess.refresh_token) return null
  var r = await api('/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    body: { refresh_token: sess.refresh_token }
  })
  if (r.error || !r.data) return null
  var newSess = {
    access_token: r.data.access_token,
    refresh_token: r.data.refresh_token || sess.refresh_token,
    expires_in: r.data.expires_in,
    expires_at: r.data.expires_at || Math.floor(Date.now() / 1000 + (r.data.expires_in || 3600)),
    token_type: r.data.token_type
  }
  saveLocalSession(newSess)
  return newSess
}

async function ensureSession() {
  if (!session) session = getLocalSession()
  if (!session) return null
  if (session.expires_at && session.expires_at * 1000 < Date.now() + 60000) {
    var refreshed = await refreshSession(session)
    if (refreshed) session = refreshed
    else { session = null; saveLocalSession(null) }
  }
  return session
}

function notifyListeners(event, sess) {
  listeners.forEach(function(l) {
    if (l.event === event) l.callback(sess)
  })
}

// --- Public API (matches Supabase SDK interface) ---
window.__supabase = {
  auth: {
    getSession: async function() {
      var sess = await ensureSession()
      return { data: { session: sess ? { user: makeUser(sess), access_token: sess.access_token } : null }, error: null }
    },
    onAuthStateChange: function(callback) {
      listeners.push({ event: 'SIGNED_IN', callback: function(s) { callback('SIGNED_IN', s ? { user: makeUser(s) } : null) } })
      listeners.push({ event: 'SIGNED_OUT', callback: function() { callback('SIGNED_OUT', null) } })
      return { data: { subscription: { unsubscribe: function() { listeners = [] } } } }
    },
    signOut: async function() {
      session = null
      saveLocalSession(null)
      notifyListeners('SIGNED_OUT', null)
      return { error: null }
    },
    signInWithOAuth: async function(options) {
      var redirectUrl = options.options?.redirectTo || window.location.origin + '/SiteProject/auth/callback'
      var url = URL + '/auth/v1/authorize?provider=' + options.provider + '&redirect_to=' + encodeURIComponent(redirectUrl)
      window.location.href = url
      return { data: { url: url }, error: null }
    },
    exchangeCodeForSession: async function(code) {
      var r = await api('/auth/v1/token?grant_type=pbkdf_token', { method: 'POST', body: { auth_code: code } })
      if (r.error || !r.data) {
        r = await api('/auth/v1/token?grant_type=authorization_code', { method: 'POST', body: { auth_code: code } })
      }
      if (r.error || !r.data) return { data: null, error: r.error }
      var sess = {
        access_token: r.data.access_token,
        refresh_token: r.data.refresh_token,
        expires_in: r.data.expires_in,
        expires_at: r.data.expires_at || Math.floor(Date.now() / 1000 + (r.data.expires_in || 3600)),
        token_type: r.data.token_type
      }
      session = sess
      saveLocalSession(sess)
      notifyListeners('SIGNED_IN', sess)
      return { data: { session: { user: makeUser(sess) }, user: makeUser(sess) }, error: null }
    }
  },

  from: function(table) {
    return new QueryBuilder(table)
  },

  storage: {
    from: function(bucket) {
      return {
        upload: async function(path, file) {
          var sess = await ensureSession()
          var headers = { 'apikey': KEY }
          if (sess) {
            headers['Authorization'] = 'Bearer ' + sess.access_token
          }
          if (file && file.type) headers['Content-Type'] = file.type
          var res = await fetch(URL + '/storage/v1/object/' + bucket + '/' + encodeURI(path), {
            method: 'POST',
            headers: headers,
            body: file
          })
          if (!res.ok) {
            var errText = await res.text()
            return { data: null, error: { message: errText || 'Upload failed' } }
          }
          var json = null
          try { json = await res.json() } catch (e) {}
          return { data: json, error: null }
        },
        getPublicUrl: function(path) {
          return { data: { publicUrl: URL + '/storage/v1/object/public/' + bucket + '/' + path } }
        },
        remove: async function(paths) {
          var sess = await ensureSession()
          if (!sess) return { data: null, error: { message: 'Not authenticated' } }
          return api('/storage/v1/object/' + bucket, {
            method: 'DELETE',
            token: sess.access_token,
            body: { prefixes: paths }
          })
        }
      }
    }
  }
}

// --- Query Builder ---
function QueryBuilder(table) {
  this._table = table
  this._selectCols = '*'
  this._filters = []
  this._orderCol = null
  this._orderAsc = true
  this._limitVal = null
  this._offsetVal = null
  this._single = false
  this._maybeSingle = false
  this._countOpts = null
  this._body = null
  this._useServiceRole = false
}

QueryBuilder.prototype.select = function(cols) { this._selectCols = cols || '*'; return this }
QueryBuilder.prototype.insert = function(data) { this._body = data; this._method = 'POST'; return this }
QueryBuilder.prototype.update = function(data) { this._body = data; this._method = 'PATCH'; return this }
QueryBuilder.prototype.delete = function() { this._method = 'DELETE'; return this }
QueryBuilder.prototype.eq = function(col, val) { this._filters.push(col + '=eq.' + encodeURIComponent(val)); return this }
QueryBuilder.prototype.neq = function(col, val) { this._filters.push(col + '=neq.' + encodeURIComponent(val)); return this }
QueryBuilder.prototype.gt = function(col, val) { this._filters.push(col + '=gt.' + encodeURIComponent(val)); return this }
QueryBuilder.prototype.gte = function(col, val) { this._filters.push(col + '=gte.' + encodeURIComponent(val)); return this }
QueryBuilder.prototype.lt = function(col, val) { this._filters.push(col + '=lt.' + encodeURIComponent(val)); return this }
QueryBuilder.prototype.lte = function(col, val) { this._filters.push(col + '=lte.' + encodeURIComponent(val)); return this }
QueryBuilder.prototype.like = function(col, val) { this._filters.push(col + '=like.' + encodeURIComponent(val)); return this }
QueryBuilder.prototype.in = function(col, vals) { this._filters.push(col + '=in.(' + vals.map(encodeURIComponent).join(',') + ')'); return this }
QueryBuilder.prototype.order = function(col, opts) { this._orderCol = col; this._orderAsc = !opts || opts.ascending !== false; return this }
QueryBuilder.prototype.limit = function(n) { this._limitVal = n; return this }
QueryBuilder.prototype.offset = function(n) { this._offsetVal = n; return this }
QueryBuilder.prototype.single = function() { this._single = true; return this }
QueryBuilder.prototype.maybeSingle = function() { this._maybeSingle = true; return this }
QueryBuilder.prototype.selectCount = function(opts) { this._countOpts = opts; return this }
QueryBuilder.prototype.useServiceRole = function() { this._useServiceRole = true; return this }

QueryBuilder.prototype.execute = async function() {
  var sess = await ensureSession()
  var token = this._useServiceRole ? KEY : (sess ? sess.access_token : KEY)

  if (this._countOpts) {
    var countUrl = '/rest/v1/' + this._table + '?select=*&' + this._filters.join('&')
    var countHeaders = { 'apikey': KEY, 'Prefer': 'count=' + (this._countOpts.exact || this._countOpts.planned || 'exact') }
    countHeaders['Authorization'] = 'Bearer ' + token
    var countRes = await fetch(URL + countUrl, { headers: countHeaders })
    var count = countRes.headers.get('content-range')
    if (count) {
      var m = count.match(/\/(\d+)/)
      return { data: null, count: m ? parseInt(m[1], 10) : 0, error: null }
    }
    return { data: null, count: 0, error: null }
  }

  if (this._method === 'POST' || this._method === 'PATCH' || this._method === 'DELETE') {
    var headers = { 'apikey': KEY, 'Content-Type': 'application/json', 'Prefer': 'return=representation' }
    headers['Authorization'] = 'Bearer ' + KEY
    var path = '/rest/v1/' + this._table
    var params = []
    if (this._selectCols) params.push('select=' + encodeURIComponent(this._selectCols))
    if (this._filters.length > 0 && this._method !== 'POST') params = params.concat(this._filters)
    if (params.length > 0) path += '?' + params.join('&')
    if (this._single || this._maybeSingle) headers['Accept'] = 'application/vnd.pgrst.object+json'
    var fetchOpts = { method: this._method, headers: headers }
    if (this._body) fetchOpts.body = JSON.stringify(this._body)
    var res = await fetch(URL + path, fetchOpts)
    var text = await res.text()
    var json = null
    try { json = JSON.parse(text) } catch (e) {}
    if (!res.ok) return { data: null, error: { message: (json && json.message) || text || 'Request failed' }, count: null }
    if (this._single || this._maybeSingle) {
      if (Array.isArray(json)) return { data: json.length > 0 ? json[0] : null, error: null, count: null }
      return { data: json || null, error: null, count: null }
    }
    return { data: json, error: null, count: null }
  }

  // SELECT
  var path2 = '/rest/v1/' + this._table + '?select=' + encodeURIComponent(this._selectCols)
  if (this._filters.length > 0) path2 += '&' + this._filters.join('&')
  if (this._orderCol) path2 += '&order=' + this._orderCol + '.' + (this._orderAsc ? 'asc' : 'desc')
  if (this._limitVal !== null) path2 += '&limit=' + this._limitVal
  if (this._offsetVal !== null) path2 += '&offset=' + this._offsetVal
  var selHeaders = { 'apikey': KEY }
  if (token) selHeaders['Authorization'] = 'Bearer ' + token
  if (this._single || this._maybeSingle) selHeaders['Accept'] = 'application/vnd.pgrst.object+json'
  var selRes = await fetch(URL + path2, { headers: selHeaders })
  var selText = await selRes.text()
  var selJson = null
  try { selJson = JSON.parse(selText) } catch (e) {}
  if (!selRes.ok) return { data: null, error: { message: (selJson && selJson.message) || selText || 'Request failed' } }
  if (this._maybeSingle) {
    if (Array.isArray(selJson)) return { data: selJson.length > 0 ? selJson[0] : null, error: null }
    return { data: selJson || null, error: null }
  }
  return { data: selJson, error: null }
}

// Make execute auto-called when then/catch is used (thenable pattern)
QueryBuilder.prototype.then = function(resolve, reject) {
  return this.execute().then(resolve, reject)
}
QueryBuilder.prototype.catch = function(fn) {
  return this.execute().catch(fn)
}

})()
