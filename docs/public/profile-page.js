;(function() {
var RECENT_KEY = 'rd_recent_articles'
var FAVORITE_KEY = 'rd_article_favorites'
var state = { tab: 'articles', sb: null, uid: '', profile: {}, articles: [], favorites: [], recent: [], profileChanges: [], favoriteTableReady: true }

function $(id) { return document.getElementById(id) }
function show(id, ok) { var el = $(id); if (el) el.style.display = ok ? 'block' : 'none' }
function esc(v) { return String(v || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;') }
function date(v) { return v ? new Date(v).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }) : '未知时间' }
function time(v) { return v ? new Date(v).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '未知时间' }
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

async function waitSupabase() {
  for (var i = 0; i < 30; i++) {
    if (window.getSupabaseClient?.()) return window.getSupabaseClient?.()
    await new Promise(function(resolve) { setTimeout(resolve, 100) })
  }
  return null
}

function setTab(tab) {
  state.tab = tab
  Array.prototype.forEach.call(document.querySelectorAll('.profile-tabs button'), function(button) { button.classList.remove('active') })
  Array.prototype.forEach.call(document.querySelectorAll('.panel'), function(panel) { panel.style.display = 'none' })
  var tabButton = $('tab-' + tab)
  if (tabButton) tabButton.classList.add('active')
  show('panel-' + tab, true)
  var url = new URL(window.location.href)
  url.searchParams.set('tab', tab)
  window.history.replaceState({}, '', url.toString())
}

function permissionModel(role) {
  return window.RDPermissions
    ? window.RDPermissions.derivePermissions(role)
    : { role: role === 'admin' || role === 'member' ? role : 'user', isAdmin: role === 'admin' }
}
function roleText(role) { return window.RDPermissions ? window.RDPermissions.roleLabel(role) : ({ user: '普通用户', member: '社员', admin: '管理员' })[permissionModel(role).role] }
function roleDesc(role) { return window.RDPermissions ? window.RDPermissions.roleDescription(role) : ({ user: '可以维护资料、收藏内容和参与讨论', member: '可以发布文章、访问内部资源和参与讨论', admin: '拥有审核与后台管理权限' })[permissionModel(role).role] }

function setProfile(session, profile) {
  var meta = session.user.user_metadata || {}
  var name = profile.username || meta.full_name || meta.user_name || meta.name || meta.preferred_username || session.user.email || '社团成员'
  var avatar = profile.avatar_url || meta.avatar_url || meta.picture || '/images/default-avatar.svg'
  var role = permissionModel(profile.role).role
  var permissions = permissionModel(role)
  state.profile = { username: name, avatar: avatar, bio: profile.bio || '', role: role, email: session.user.email || '' }
  $('profile-avatar').src = avatar
  $('profile-name').textContent = name
  $('profile-email').textContent = session.user.email || ''
  $('profile-bio').textContent = state.profile.bio || '还没有填写个人简介'
  $('role-label').textContent = roleText(role)
  $('role-desc').textContent = roleDesc(role)
  $('avatar-frame').className = 'avatar-frame ' + (permissions.isAdmin ? 'admin-frame' : permissions.isMember ? 'member-frame' : 'user-frame')
  $('role-block').className = 'role-block ' + (permissions.isAdmin ? 'admin-role' : permissions.isMember ? 'member-role' : 'user-role')
}

async function loadProfile() {
  if (!window.RDProfiles) throw new Error('Profiles service unavailable')
  return (await window.RDProfiles.getProfile(state.uid)) || {}
}

async function loadArticles() {
  if (!window.RDArticles) throw new Error('Articles service unavailable')
  state.articles = await window.RDArticles.listAuthorArticles(state.uid)
}

async function fetchByIds(ids, rows, idKey) {
  ids = Array.from(new Set((ids || []).filter(Boolean)))
  if (!ids.length) return []
  if (!window.RDArticles) return []
  var articles = await window.RDArticles.getArticles(ids)
  var map = {}
  ;(articles || []).forEach(function(a) { map[a.id] = a })
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
  var rows = localList(RECENT_KEY).filter(function(row) { return row && row.id })
  state.recent = await fetchByIds(rows.map(function(row) { return row.id }), rows, 'id')
}

async function loadProfileChanges() {
  if (!window.RDProfiles) throw new Error('Profiles service unavailable')
  state.profileChanges = await window.RDProfiles.getPendingProfileChanges(state.uid)
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

function renderCards(id, title, subtitle, items, emptyText, label, key) {
  var html = items.map(function(a) {
    return '<a class="article-card" href="' + articleUrl(a.id) + '"><img src="' + esc(a.cover_url || '/images/default-cover.svg') + '" alt="' + esc(a.title) + '"><div><h3>' + esc(a.title) + '</h3><p>' + esc(a.summary || '暂无摘要') + '</p><span>' + label + ' ' + time(a[key]) + '</span></div></a>'
  }).join('')
  $(id).innerHTML = '<div class="panel-head"><div><h2>' + title + '</h2><p>' + subtitle + '</p></div></div>' + (items.length ? '<div class="card-grid">' + html + '</div>' : '<div class="empty-state">' + emptyText + '</div>')
}

function renderSettings() {
  var pending = state.profileChanges.length ? '<div class="pending-review-box"><strong>待审核资料</strong><p>你有 ' + state.profileChanges.length + ' 条个人信息修改正在等待管理员审核。新的提交会继续进入审核队列。</p></div>' : ''
  $('panel-settings').innerHTML = '<div class="settings-card"><div id="settings-success" class="success-message" style="display:none"></div><div id="settings-error" class="error-message" style="display:none"></div>' + pending + '<div class="settings-avatar-row"><img id="settings-avatar" src="' + esc(state.profile.avatar) + '" alt="头像预览"><label id="upload-button" class="upload-button">点击或拖拽上传头像<input id="avatar-input" type="file" accept="image/*"></label></div><div class="settings-form"><label><span>修改昵称</span><input id="settings-username" type="text" maxlength="40" value="' + esc(state.profile.username) + '"></label><label><span>个人简介</span><textarea id="settings-bio" rows="4" maxlength="160">' + esc(state.profile.bio) + '</textarea></label><p class="form-note">头像、昵称和简介修改都会提交给管理员审核，通过后才会在站内生效。</p><button id="settings-submit" class="submit-button" type="button" onclick="saveProfileSettings()">提交审核</button></div></div>'
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
  renderCards('panel-favorites', '我的收藏', state.favoriteTableReady ? '保存在账号下的收藏文章' : '当前显示本机浏览器收藏', state.favorites, '暂无收藏文章', '收藏于', 'favorited_at')
  renderCards('panel-recent', '最近观看', '只记录当前浏览器中最近打开过的文章', state.recent, '暂无观看记录', '观看于', 'viewed_at')
  renderSettings()
}

function settingError(msg) { var el = $('settings-error'); if (el) { el.textContent = msg; el.style.display = 'block' } }
function settingSuccess(msg) { var el = $('settings-success'); if (el) { el.textContent = msg; el.style.display = 'block' } }

async function uploadAvatar(e) {
  var file = e.dataTransfer && e.dataTransfer.files ? e.dataTransfer.files[0] : e.target.files && e.target.files[0]
  if (!file) return
  if (!file.type.startsWith('image/')) return settingError('请选择图片文件')
  if (file.size > 2 * 1024 * 1024) return settingError('头像图片不能超过 2MB')
  var button = $('upload-button')
  if (button) button.childNodes[0].nodeValue = '上传中...'
  try {
    var ext = file.name.split('.').pop() || 'png'
    var path = 'avatars/' + state.uid + '/' + Date.now() + '.' + ext
    var up = await state.sb.storage.from('avatars').upload(path, file)
    if (up.error) throw up.error
    var url = state.sb.storage.from('avatars').getPublicUrl(path).data.publicUrl
    $('settings-avatar').src = url
    $('settings-avatar').dataset.uploadedUrl = url
  } catch (err) {
    settingError(window.RDErrors?.toUserMessage(err) || '头像上传失败，请稍后重试')
  } finally {
    if (button) button.childNodes[0].nodeValue = '点击或拖拽上传头像'
    if (e.target) e.target.value = ''
  }
}

async function saveSettings() {
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
    if (!window.RDProfiles) throw new Error('Profiles service unavailable')
    var created = await window.RDProfiles.submitProfileChange(payload)
    state.profileChanges.unshift(created)
    settingSuccess('资料修改已提交，等待管理员审核后生效')
  } catch (err) {
    settingError(window.RDErrors?.toUserMessage(err) || '提交失败，请稍后重试')
  } finally {
    button.disabled = false
    button.textContent = '提交审核'
  }
}

async function init() {
  var root = $('profile-page')
  if (!root || root.dataset.loaded) return
  root.dataset.loaded = '1'
  renderShell()
  try {
    state.tab = new URLSearchParams(window.location.search).get('tab') || 'articles'
    state.sb = await waitSupabase()
    if (!state.sb) throw new Error('Supabase 未加载，请刷新页面后重试')
    var sr = await state.sb.auth.getSession()
    var session = sr.data && sr.data.session
    if (!session) {
      show('loading', false)
      show('not-logged-in', true)
      return
    }
    state.uid = session.user.id
    setProfile(session, await loadProfile())
    await Promise.all([loadArticles(), loadFavorites(), loadRecent(), loadProfileChanges()])
    renderAll()
    show('loading', false)
    show('profile-app', true)
    setTab(state.tab)
  } catch (err) {
    show('loading', false)
    $('profile-error').textContent = window.RDErrors?.toUserMessage(err) || '加载失败，请稍后重试'
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
