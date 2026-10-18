;(function() {
var RECENT_KEY = 'rd_recent_articles'
var FAVORITE_KEY = 'rd_article_favorites'
var state = { tab: 'articles', sb: null, uid: '', profile: {}, articles: [], favorites: [], recent: [], profileChanges: [], favoriteTableReady: true }

function $(id) { return document.getElementById(id) }
function show(id, ok) { var el = $(id); if (el) el.style.display = ok ? 'block' : 'none' }
function esc(v) { return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;') }
function date(v) { return v ? new Date(v).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '未知时间' }
function time(v) { return v ? new Date(v).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '未知时间' }
function historyTime(v) {
  var value = new Date(v)
  if (!v || !Number.isFinite(value.getTime())) return '未知时间'
  var parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai', year: '2-digit', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(value)
  var fields = {}; parts.forEach(function(part) { fields[part.type] = part.value })
  return fields.year + '/' + fields.month + '/' + fields.day + '/' + fields.hour + ':' + fields.minute
}
function cardImage(a) { return '<img class="profile-article-image" src="' + esc(a.first_image_url || '/images/hero-bg.jpg') + '" alt="' + esc(a.title) + '" loading="lazy">' }
function bindCardImages(id) {
  $(id).querySelectorAll('.profile-article-image').forEach(function(image) { image.onerror = function() { this.onerror = null; this.src = '/images/hero-bg.jpg' } })
}
function statusText(v) { return ({ draft: '草稿', pending: '待审核', published: '已发布', rejected: '已拒绝' })[v] || v || '未知' }
function views(a) { return Number(a.views_count || a.view_count || a.read_count || 0) }
function articleUrl(id) { return '/article?id=' + encodeURIComponent(id) }
function editorUrl(id) { return '/editor?id=' + encodeURIComponent(id) }
function localList(key) { try { var v = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(v) ? v : [] } catch (e) { return [] } }

function renderShell() {
  var root = $('profile-page')
  if (!root || root.dataset.ready) return
  root.dataset.ready = '1'
  root.innerHTML = '<div id="not-logged-in" class="state-panel" style="display:none"><p>请先 <a href="/login">登录</a></p></div><div id="loading" class="state-panel"><p>加载中...</p></div><div id="profile-app" class="profile-layout" style="display:none"><section class="profile-hero"><div id="avatar-frame" class="avatar-frame member-frame"><img id="profile-avatar" class="user-avatar" src="/images/default-avatar.svg" alt="头像"></div><div class="profile-identity"><h1 id="profile-name"></h1><div id="role-block" class="role-block member-role"><strong id="role-label"></strong><span id="role-desc"></span></div><p id="profile-email" class="email"></p><p id="profile-bio" class="bio"></p></div><section class="stats-card" aria-label="个人统计"><div><strong id="stat-likes">0</strong><span>收到的赞</span></div><div><strong id="stat-articles">0</strong><span>发布文章数</span></div><div><strong id="stat-favorites">0</strong><span>收藏的文章</span></div></section></section><section class="profile-body"><aside class="profile-sidebar"><nav class="profile-tabs" aria-label="个人中心功能"><button id="tab-articles" type="button" onclick="setProfileTab(\'articles\')">我的文章</button><button id="tab-favorites" type="button" onclick="setProfileTab(\'favorites\')">我的收藏</button><button id="tab-recent" type="button" onclick="setProfileTab(\'recent\')">历史记录</button><button id="tab-settings" type="button" onclick="setProfileTab(\'settings\')">个人信息</button></nav></aside><main class="profile-main"><div id="profile-error" class="error-message" style="display:none"></div><section id="panel-articles" class="panel"></section><section id="panel-favorites" class="panel" style="display:none"></section><section id="panel-recent" class="panel" style="display:none"></section><section id="panel-settings" class="panel" style="display:none"></section></main></section></div>'
}

function addAccountPanels() {
  var nav = document.querySelector('#profile-page .profile-tabs')
  var main = document.querySelector('#profile-page .profile-main')
  if (!nav || $('panel-mcp')) return
  ;[['mcp', 'AI / MCP 接入'], ['security', '账号安全']].forEach(function(item) {
    var button = document.createElement('button')
    button.id = 'tab-' + item[0]; button.type = 'button'; button.textContent = item[1]
    button.onclick = function() { setTab(item[0]) }
    nav.appendChild(button)
    var panel = document.createElement('section')
    panel.id = 'panel-' + item[0]; panel.className = 'panel'; panel.style.display = 'none'
    main.appendChild(panel)
  })
}

async function waitSupabase() {
  for (var i = 0; i < 30; i++) {
    if (window.__supabase) return window.__supabase
    await new Promise(function(resolve) { setTimeout(resolve, 100) })
  }
  return null
}

function setTab(tab) {
  if (state.publicView) return
  if (!['articles', 'favorites', 'recent', 'settings', 'mcp', 'security'].includes(tab)) tab = 'articles'
  state.tab = tab
  Array.prototype.forEach.call(document.querySelectorAll('.profile-tabs button'), function(button) { button.classList.remove('active') })
  Array.prototype.forEach.call(document.querySelectorAll('.panel'), function(panel) { panel.style.display = 'none' })
  var tabButton = $('tab-' + tab)
  if (tabButton) tabButton.classList.add('active')
  show('panel-' + tab, true)
  var url = new URL(window.location.href)
  url.searchParams.set('tab', tab)
  window.history.replaceState({}, '', url.toString())
  window.dispatchEvent(new CustomEvent('rd:profile-tab', { detail: { tab: tab } }))
  if (tab === 'security') renderSecurity()
}

async function accountRequest(path, method, body) {
  var response = await fetch('/api/account/github' + path, { method: method || 'GET', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-RD-CSRF': '1' }, body: body ? JSON.stringify(body) : undefined })
  var data = await response.json()
  if (!response.ok) throw new Error(data.message || '账号请求失败')
  return data
}

async function renderSecurity() {
  var panel = $('panel-security')
  panel.innerHTML = '<h2>账号安全</h2><p role="status">加载绑定信息…</p>'
  try {
    var data = await accountRequest('')
    if (!panel.isConnected) return
    var failure = new URLSearchParams(location.search).get('binding') === 'failed'
    panel.innerHTML = '<h2>账号安全</h2><p>当前 GitHub：<strong>' + esc(data.username) + '</strong></p><p>改绑保留文章、收藏、经验与角色。完成后其他设备登录和全部 MCP 上传令牌会失效。</p>' + (failure ? '<p class="error-message" role="alert">验证未完成、账号不匹配或新账号已被占用。请重新开始。</p>' : '') + '<div id="binding-error" role="alert"></div>'
    if (data.managed || !data.available) {
      panel.insertAdjacentHTML('beforeend', '<p>' + (data.managed ? '此账号由服务器配置指定为管理员，需要由运维同步修改绑定和服务器配置。' : 'GitHub 授权暂不可用，请稍后重试。') + '</p>')
      return
    }
    var stage = data.stage
    if (stage === 'choose-new') panel.insertAdjacentHTML('beforeend', '<p>原账号已验证，请选择新的 GitHub 账号。</p>')
    if (stage === 'confirm') panel.insertAdjacentHTML('beforeend', '<p>新账号已验证：<strong>' + esc(data.target) + '</strong>。确认后才会替换原绑定。</p>')
    var button = document.createElement('button')
    button.type = 'button'; button.className = 'submit-button'
    button.textContent = stage === 'confirm' ? '确认改绑' : stage === 'choose-new' ? '验证新 GitHub 账号' : '验证原 GitHub 账号'
    button.onclick = async function() {
      if (stage === 'confirm' && !window.confirm('确认改绑为 ' + data.target + '？其他设备登录和所有 MCP 上传令牌将失效。')) return
      button.disabled = true
      try {
        if (stage === 'confirm') {
          await accountRequest('/confirm', 'POST', {})
          window.history.replaceState({}, '', '/user/profile?tab=security')
          await renderSecurity()
          $('panel-security').insertAdjacentHTML('afterbegin', '<p class="success-message" role="status">GitHub 改绑成功，请重新配置 MCP 上传令牌。</p>')
        } else {
          var result = await accountRequest('/start', 'POST', { step: stage === 'choose-new' ? 'new' : 'original' })
          location.assign(result.authorization_url)
        }
      } catch (error) { if ($('binding-error')) $('binding-error').textContent = error.message; button.disabled = false }
    }
    panel.appendChild(button)
    if (stage !== 'idle') {
      var cancel = document.createElement('button')
      cancel.type = 'button'; cancel.className = 'binding-cancel'; cancel.textContent = '取消改绑'
      cancel.onclick = async function() { cancel.disabled = true; try { await accountRequest('', 'DELETE'); await renderSecurity() } catch (error) { $('binding-error').textContent = error.message; cancel.disabled = false } }
      panel.appendChild(cancel)
    }
  } catch (error) { panel.innerHTML = '<h2>账号安全</h2><p class="error-message" role="alert">' + esc(error.message) + '</p><button type="button" id="binding-retry">重试</button>'; $('binding-retry').onclick = renderSecurity }
}

function roleText(role) { return role === 'admin' ? '管理员' : '社员' }
function roleDesc(role) { return role === 'admin' ? '拥有审核与后台管理权限' : '可以发布文章、收藏内容和参与讨论' }

function setProfile(session, profile) {
  var meta = session.user.user_metadata || {}
  var name = profile.username || meta.full_name || meta.user_name || meta.name || meta.preferred_username || session.user.email || '社团成员'
  var avatar = profile.avatar_url || meta.avatar_url || meta.picture || '/images/default-avatar.svg'
  var role = profile.role || 'member'
  state.profile = { username: name, avatar: avatar, bio: profile.bio || '', role: role, email: session.user.email || '' }
  $('profile-avatar').src = avatar
  $('profile-avatar').onerror = function() { this.onerror = null; this.src = '/images/default-avatar.svg' }
  $('profile-name').textContent = name
  var identity = document.createElement('a')
  identity.id = 'profile-experience'
  identity.className = 'profile-experience'
  identity.href = '/tasks'
  identity.textContent = '任务与经验'
  var previous = $('profile-experience')
  if (previous) previous.remove()
  $('profile-name').insertAdjacentElement('afterend', identity)
  $('profile-email').textContent = session.user.email || ''
  $('profile-bio').textContent = state.profile.bio || '还没有填写个人简介'
  $('role-label').textContent = roleText(role)
  $('role-desc').textContent = roleDesc(role)
  $('avatar-frame').className = 'avatar-frame ' + (role === 'admin' ? 'admin-frame' : 'member-frame')
  $('role-block').className = 'role-block ' + (role === 'admin' ? 'admin-role' : 'member-role')
}

async function loadProfile() {
  var r = await state.sb.from('profiles').select('id, username, avatar_url, bio, role').eq('id', state.uid).maybeSingle()
  return r.data || {}
}

async function loadArticles() {
  var r = await state.sb.from('articles').select('id, title, summary, cover_url, status, visibility, created_at, likes_count, comments_count, views_count, reject_reason').eq('author_id', state.uid).order('created_at', { ascending: false })
  if (r.error) r = await state.sb.from('articles').select('id, title, summary, cover_url, status, visibility, created_at, likes_count, comments_count, reject_reason').eq('author_id', state.uid).order('created_at', { ascending: false })
  if (r.error) throw new Error(r.error.message)
  state.articles = r.data || []
}

async function fetchByIds(ids, rows, idKey) {
  ids = Array.from(new Set((ids || []).filter(Boolean)))
  if (!ids.length) return []
  var r = await state.sb.from('articles').select('id, title, summary, first_image_url, status, visibility, created_at, likes_count, comments_count, views_count').in('id', ids)
  if (r.error) r = await state.sb.from('articles').select('id, title, summary, first_image_url, status, visibility, created_at, likes_count, comments_count').in('id', ids)
  if (r.error) return []
  var map = {}
  ;(r.data || []).forEach(function(a) { map[a.id] = a })
  var order = rows && rows.length ? rows : ids.map(function(id) { return { id: id } })
  return order.map(function(row) {
    var id = idKey ? row[idKey] : row.id
    return map[id] ? Object.assign({}, map[id], { viewed_at: row.viewed_at, favorited_at: row.created_at }) : null
  }).filter(Boolean)
}

async function loadFavorites() {
  var r = await state.sb.from('article_favorites').select('article_id, created_at').eq('user_id', state.uid).order('created_at', { ascending: false })
  if (r.error) {
    state.favoriteTableReady = false
    state.favorites = await fetchByIds(localList(FAVORITE_KEY))
    return
  }
  state.favoriteTableReady = true
  var rows = r.data || []
  state.favorites = await fetchByIds(rows.map(function(row) { return row.article_id }), rows, 'article_id')
}

async function loadRecent() {
  state.historyError = ''
  if (!state.sb.reading) { state.recent = []; state.historyError = '浏览记录暂不可用'; return }
  var result = await state.sb.reading.history(state.recentOffset || 0)
  if (result.error) { state.recent = []; state.historyError = result.error.message; return }
  state.recent = result.data.items
  var articles = await fetchByIds(state.recent.map(function(a) { return a.id }))
  var details = {}; articles.forEach(function(a) { details[a.id] = a })
  state.recent = state.recent.map(function(a) { return Object.assign({}, a, details[a.id] || {}, { viewed_at: a.viewed_at, reading_seconds: a.reading_seconds }) })
  state.hasMoreRecent = result.data.has_more
}

async function loadMemberIdentity() {
  var uid = state.uid
  var controller = new AbortController()
  var timeout = setTimeout(function() { controller.abort() }, 5000)
  try {
    var response = await fetch('/api/tasks/me', { credentials: 'same-origin', signal: controller.signal })
    if (!response.ok) return
    var data = await response.json()
    var el = $('profile-experience')
    if (!el || state.uid !== uid) return
    var branch = (data.disciplines || []).find(function(d) { return d.id === data.identity.discipline_id })
    var office = { president: '会长', 'vice-president': '副会长' }[data.identity.office]
    el.textContent = ''
    var badge = document.createElement('span')
    badge.className = 'rank-badge ' + (data.identity.office === 'president' ? 'rank-president' : ({ '新人': 'rank-new', '见习社员': 'rank-apprentice', '正式社员': 'rank-member', '资深社员': 'rank-senior' }[data.level.title] || 'rank-new'))
    badge.textContent = data.identity.office === 'president' ? '会长' : data.level.title
    el.appendChild(badge)
    el.appendChild(document.createTextNode(' · ' + [data.xp + ' EXP', branch && branch.name, data.identity.office !== 'president' && office].filter(Boolean).join(' · ')))
  } catch (_) { /* Identity service failure must not block the profile. */ }
  finally { clearTimeout(timeout) }
}

function readingDuration(seconds) {
  seconds = Math.max(0, Number(seconds) || 0)
  return seconds < 60 ? seconds + ' 秒' : Math.floor(seconds / 60) + ' 分 ' + (seconds % 60) + ' 秒'
}
function renderRecent() {
  if (state.historyError) {
    $('panel-recent').innerHTML = '<h2>浏览记录</h2><div class="empty-state" role="status">' + esc(state.historyError) + '</div><button type="button" id="retry-reading-history">重试</button>'
    $('retry-reading-history').onclick = function() { reloadRecent(state.recentOffset || 0) }
    return
  }
  var rows = state.recent.map(function(a) {
    return '<article class="profile-history-card"><a class="article-card" href="' + articleUrl(a.id) + '">' + cardImage(a) + '<div class="profile-card-content"><h3>' + esc(a.title) + '</h3><p>' + esc(a.summary || '暂无摘要') + '</p><span>阅读 ' + readingDuration(a.reading_seconds) + '</span><time class="profile-last-viewed" datetime="' + esc(a.viewed_at) + '">最近浏览 ' + historyTime(a.viewed_at) + '</time></div></a><button type="button" data-remove-history="' + esc(a.id) + '" aria-label="移除这条浏览记录">移除</button></article>'
  }).join('')
  $('panel-recent').innerHTML = '<div class="panel-head"><h2>浏览记录</h2><button type="button" id="clear-reading-history">清空记录</button></div>' + (rows ? '<div class="card-grid">' + rows + '</div>' : '<div class="empty-state">暂无浏览记录</div>') + '<div class="history-pagination"><button type="button" id="history-prev" ' + (!state.recentOffset ? 'disabled' : '') + '>上一页</button><button type="button" id="history-next" ' + (!state.hasMoreRecent ? 'disabled' : '') + '>下一页</button></div>'
  bindCardImages('panel-recent')
  $('history-prev').onclick = function() { reloadRecent(Math.max(0, (state.recentOffset || 0) - 50)) }
  $('history-next').onclick = function() { reloadRecent((state.recentOffset || 0) + 50) }
  $('clear-reading-history').onclick = function() { if (window.confirm('清空当前账号的全部浏览记录？')) removeRecent() }
  $('panel-recent').querySelectorAll('[data-remove-history]').forEach(function(button) { button.onclick = function() { removeRecent(button.dataset.removeHistory) } })
}
async function reloadRecent(offset) {
  state.recentOffset = offset
  try { await loadRecent(); renderRecent() } catch (error) { $('profile-error').textContent = error.message; show('profile-error', true) }
}
async function removeRecent(id) {
  var result = await state.sb.reading.remove(id)
  if (result.error) { $('profile-error').textContent = result.error.message; show('profile-error', true); return }
  await reloadRecent(0)
}

async function loadProfileChanges() {
  var r = await state.sb.from('profile_changes').select('id, username, avatar_url, bio, status, created_at').eq('user_id', state.uid).eq('status', 'pending').order('created_at', { ascending: false })
  state.profileChanges = r.error ? [] : (r.data || [])
}

function renderStats() {
  var likes = state.articles.reduce(function(sum, a) { return sum + Number(a.likes_count || 0) }, 0)
  var published = state.articles.filter(function(a) { return a.status === 'published' }).length
  if ($('stat-articles')) $('stat-articles').textContent = published
  if ($('stat-likes')) $('stat-likes').textContent = likes
  if ($('stat-favorites')) $('stat-favorites').textContent = state.favorites.length
}

function renderArticles() {
  var count = function(status) { return state.articles.filter(function(a) { return a.status === status }).length }
  var rows = state.articles.map(function(a) {
    return '<article class="article-row"><a class="article-title" href="' + articleUrl(a.id) + '">' + esc(a.title) + '</a><span class="status-pill status-' + esc(a.status) + '">' + statusText(a.status) + '</span><span>' + date(a.created_at) + '</span><span>浏览 ' + views(a) + '</span><span>点赞 ' + (a.likes_count || 0) + '</span><span>评论 ' + (a.comments_count || 0) + '</span><div class="row-actions"><a href="' + articleUrl(a.id) + '">查看</a><a href="' + editorUrl(a.id) + '">编辑</a></div></article>'
  }).join('')
  $('panel-articles').innerHTML = '<div class="panel-head"><div><h2>我的文章</h2><p>查看文章状态、浏览量、点赞量和评论量</p></div><a class="primary-link" href="/editor">新建文章</a></div><div class="status-grid"><div><strong>' + count('published') + '</strong><span>已发布</span></div><div><strong>' + count('pending') + '</strong><span>待审核</span></div><div><strong>' + count('draft') + '</strong><span>草稿</span></div><div><strong>' + count('rejected') + '</strong><span>已拒绝</span></div></div>' + (state.articles.length ? '<div class="article-table">' + rows + '</div>' : '<div class="empty-state">暂无文章</div>')
}

function bindArticleActions() {
  $('panel-articles').querySelectorAll('.article-row').forEach(function(row, index) {
    var article = state.articles[index]
    var button = document.createElement('button')
    button.type = 'button'; button.className = 'article-delete'; button.textContent = '删除'
    button.setAttribute('aria-label', '删除文章：' + article.title)
    button.onclick = async function() {
      if (!window.confirm('永久删除《' + article.title + '》？文章及关联评论、收藏将被移除，不能恢复。')) return
      button.disabled = true; button.textContent = '删除中…'
      try {
        var result = await state.sb.from('articles').delete().eq('id', article.id).eq('author_id', state.uid).select('id')
        if (result.error) throw result.error
        if (!result.data || !result.data.length) throw new Error('文章不存在或没有删除权限，请刷新后重试')
        await Promise.all([loadArticles(), loadFavorites()])
        renderStats(); renderArticles(); bindArticleActions()
        renderCards('panel-favorites', '我的收藏', '保存在账号下的收藏文章', state.favorites, '暂无收藏文章', '收藏于', 'favorited_at')
        $('profile-error').textContent = ''; show('profile-error', false)
      } catch (error) { $('profile-error').textContent = '删除失败：' + error.message; show('profile-error', true); button.disabled = false; button.textContent = '删除' }
    }
    row.querySelector('.row-actions').appendChild(button)
  })
}

function renderCards(id, title, subtitle, items, emptyText, label, key) {
  var html = items.map(function(a) {
    return '<a class="article-card" href="' + articleUrl(a.id) + '">' + cardImage(a) + '<div><h3>' + esc(a.title) + '</h3><p>' + esc(a.summary || '暂无摘要') + '</p><span>' + label + ' ' + time(a[key]) + '</span></div></a>'
  }).join('')
  $(id).innerHTML = '<div class="panel-head"><div><h2>' + title + '</h2><p>' + subtitle + '</p></div></div>' + (items.length ? '<div class="card-grid">' + html + '</div>' : '<div class="empty-state">' + emptyText + '</div>')
  bindCardImages(id)
}

function renderSettings() {
  var selfApproved = state.profile.role === 'admin'
  var pending = state.profileChanges.length ? '<div class="pending-review-box"><strong>待审核资料</strong><p>你有 ' + state.profileChanges.length + ' 条个人信息修改正在等待管理员审核。新的提交会继续进入审核队列。</p></div>' : ''
  $('panel-settings').innerHTML = '<div class="settings-card"><div id="settings-success" class="success-message" style="display:none"></div><div id="settings-error" class="error-message" style="display:none"></div>' + pending + '<div class="settings-avatar-row"><img id="settings-avatar" src="' + esc(state.profile.avatar) + '" alt="头像预览"><label id="upload-button" class="upload-button">点击或拖拽上传头像<input id="avatar-input" type="file" accept="image/*"></label></div><div class="settings-form"><label><span>修改昵称</span><input id="settings-username" type="text" maxlength="40" value="' + esc(state.profile.username) + '"></label><label><span>个人简介</span><textarea id="settings-bio" rows="4" maxlength="160">' + esc(state.profile.bio) + '</textarea></label><p class="form-note">' + (selfApproved ? '管理员本人的头像、昵称和简介保存后立即生效。' : '头像、昵称和简介修改都会提交给管理员审核，通过后才会在站内生效。') + '</p><button id="settings-submit" class="submit-button" type="button" onclick="saveProfileSettings()">' + (selfApproved ? '保存资料' : '提交审核') + '</button></div></div>'
  $('avatar-input').addEventListener('change', uploadAvatar)
  var uploadButton = $('upload-button')
  if (uploadButton) {
    uploadButton.addEventListener('dragover', function(e) { e.preventDefault(); uploadButton.classList.add('dragging') })
    uploadButton.addEventListener('dragleave', function() { uploadButton.classList.remove('dragging') })
    uploadButton.addEventListener('drop', function(e) {
      e.preventDefault()
      uploadButton.classList.remove('dragging')
      uploadAvatar(e)
    })
  }
}

function renderAll() {
  renderStats()
  renderArticles()
  bindArticleActions()
  renderCards('panel-favorites', '我的收藏', state.favoriteTableReady ? '保存在账号下的收藏文章' : '当前显示本机浏览器收藏', state.favorites, '暂无收藏文章', '收藏于', 'favorited_at')
  renderRecent()
  renderSettings()
}

function settingError(msg) { var el = $('settings-error'); if (el) { el.textContent = msg; el.style.display = 'block' } }
function settingSuccess(msg) { var el = $('settings-success'); if (el) { el.textContent = msg; el.style.display = 'block' } }

async function uploadAvatar(e) {
  var file = e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files[0] : e.target.files && e.target.files[0]
  if (!file) return
  if (!['image/png','image/jpeg','image/gif','image/webp','image/avif'].includes(file.type)) return settingError('请选择 PNG、JPEG、GIF、WebP 或 AVIF 图片')
  if (file.size > 2 * 1024 * 1024) return settingError('头像图片不能超过 2MB')
  var button = $('upload-button')
  if (state.avatarUploading) return
  state.avatarUploading = true
  $('settings-submit').disabled = true
  $('avatar-input').disabled = true
  if (button) button.childNodes[0].nodeValue = '上传中...'
  try {
    var ext = file.name.split('.').pop() || 'png'
    var path = state.uid + '/' + crypto.randomUUID() + '.' + ext
    var up = await state.sb.storage.from('avatars').upload(path, file)
    if (up.error) throw up.error
    var url = new URL(state.sb.storage.from('avatars').getPublicUrl(path).data.publicUrl, location.origin).pathname
    $('settings-avatar').src = url
    $('settings-avatar').dataset.uploadedUrl = url
  } catch (err) {
    settingError('头像上传失败：' + (err.message || '未知错误'))
  } finally {
    state.avatarUploading = false
    $('settings-submit').disabled = false
    $('avatar-input').disabled = false
    if (button) button.childNodes[0].nodeValue = '点击或拖拽上传头像'
    if (e.target) e.target.value = ''
  }
}

async function saveSettings() {
  if (state.avatarUploading) return
  var button = $('settings-submit')
  $('settings-success').style.display = 'none'
  $('settings-error').style.display = 'none'
  button.disabled = true
  button.textContent = '提交中...'
  try {
    var avatar = $('settings-avatar')
    var username = $('settings-username').value.trim()
    if (!username) throw new Error('昵称不能为空')
    var payload = { user_id: state.uid, username: username, avatar_url: avatar.dataset.uploadedUrl || null, bio: $('settings-bio').value.trim(), status: 'pending' }
    var r = await state.sb.from('profile_changes').insert(payload).select('*').single()
    if (r.error) throw r.error
    if (r.data && r.data.status === 'approved') {
      var approved = r.data
      setProfile(state.session, { username: approved.username == null ? state.profile.username : approved.username, avatar_url: approved.avatar_url || state.profile.avatar, bio: approved.bio == null ? state.profile.bio : approved.bio, role: state.profile.role })
      loadMemberIdentity()
      delete avatar.dataset.uploadedUrl
      window.dispatchEvent(new CustomEvent('rd:profile-updated'))
      settingSuccess('资料已更新，管理员本人资料已自动通过')
    } else {
      state.profileChanges.unshift(r.data || payload)
      settingSuccess('资料修改已提交，等待管理员审核后生效')
    }
  } catch (err) {
    settingError('提交失败：' + (err.message || '未知错误'))
  } finally {
    button.disabled = false
    button.textContent = state.profile.role === 'admin' ? '保存资料' : '提交审核'
  }
}

async function loadPublicProfile(id,offset) {
  state.publicView = true
  var response = await fetch('/api/members/' + encodeURIComponent(id) + '?offset=' + offset, { credentials: 'same-origin' })
  var data = await response.json()
  if (!response.ok) throw new Error(data.message || '无法加载个人主页')
  state.uid = id
  setProfile({ user: { user_metadata: {} } }, data.profile)
  $('role-desc').textContent = 'RD STUDIO 创作者'
  $('profile-experience').remove()
  document.querySelector('.profile-sidebar').style.display = 'none'
  document.querySelector('.profile-body').classList.add('public-profile-body')
  $('stat-favorites').parentElement.style.display = 'none'
  $('stat-articles').textContent = data.stats.articles
  $('stat-likes').textContent = data.stats.likes
  $('panel-articles').innerHTML = '<div class="panel-head"><h2>发布的文章</h2></div>' + (data.articles.length ? data.articles.map(function(a) {return '<article class="history-row"><a href="' + articleUrl(a.id) + '"><h3>' + esc(a.title) + '</h3><span>' + date(a.created_at) + ' · 点赞 ' + Number(a.likes_count || 0) + '</span><p>' + esc(a.summary) + '</p></a></article>'}).join('') : '<div class="empty-state">暂无公开文章</div>') + '<div class="history-pagination"><button id="public-prev" ' + (!offset ? 'disabled' : '') + '>上一页</button><button id="public-next" ' + (!data.has_more ? 'disabled' : '') + '>下一页</button></div>'
  $('public-prev').onclick = function() { publicPage(Math.max(0, offset - 20)) }
  $('public-next').onclick = function() { publicPage(offset + 20) }
  show('loading', false); show('profile-app', true); show('panel-articles', true)
}
async function publicPage(offset) {
  try { await loadPublicProfile(state.uid, offset) }
  catch (err) { $('profile-error').textContent = err.message; show('profile-error', true) }
}

async function init() {
  var root = $('profile-page')
  if (!root || root.dataset.loaded) return
  root.dataset.loaded = '1'
  renderShell()
  addAccountPanels()
  try {
    state.publicView = false
    var publicId = new URLSearchParams(window.location.search).get('id')
    if (publicId) { await loadPublicProfile(publicId, 0); return }
    state.tab = new URLSearchParams(window.location.search).get('tab') || 'articles'
    state.sb = await waitSupabase()
    if (!state.sb) throw new Error('服务未加载，请刷新页面后重试')
    var sr = await state.sb.auth.getSession()
    var session = sr.data && sr.data.session
    if (!session) {
      show('loading', false)
      show('not-logged-in', true)
      return
    }
    state.uid = session.user.id
    state.session = session
    setProfile(session, await loadProfile())
    loadMemberIdentity()
    await Promise.all([loadArticles(), loadFavorites(), loadRecent(), loadProfileChanges()])
    renderAll()
    show('loading', false)
    show('profile-app', true)
    setTab(state.tab)
  } catch (err) {
    show('loading', false)
    $('profile-error').textContent = '加载失败：' + (err.message || '未知错误')
    show('profile-error', true)
    show('profile-app', true)
  }
}

window.setProfileTab = setTab
window.saveProfileSettings = saveSettings
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init)
else setTimeout(init, 0)
setInterval(init, 500)
})()
