---
title: 个人信息审核
layout: page
---

<div id="profile-review-page">
  <div class="page-header">
    <div>
      <p class="eyebrow">管理后台</p>
      <h1>个人信息审核</h1>
    </div>
    <div class="header-actions">
      <button class="btn-secondary" type="button" onclick="loadProfileReviews()">刷新</button>
      <a href="/SiteProject/admin" class="btn-secondary">返回文章审核</a>
    </div>
  </div>

  <nav class="admin-section-nav" aria-label="审核类型">
    <a href="/SiteProject/admin">文章审核</a>
    <a class="active" href="/SiteProject/admin/profile-review">个人信息审核</a>
  </nav>

  <section class="review-summary" aria-label="个人信息审核统计">
    <div class="summary-card urgent">
      <strong id="stat-pending">0</strong>
      <span>待审核提交</span>
    </div>
    <div class="summary-card">
      <strong id="stat-users">0</strong>
      <span>涉及用户</span>
    </div>
    <div class="summary-card">
      <strong id="stat-approved">0</strong>
      <span>已通过</span>
    </div>
    <div class="summary-card">
      <strong id="stat-rejected">0</strong>
      <span>已拒绝</span>
    </div>
  </section>

  <div class="review-toolbar">
    <div class="filter-bar" aria-label="个人资料审核筛选">
      <button id="filter-pending" class="filter-btn active" type="button" onclick="filterProfileReviews('pending')">待审核</button>
      <button id="filter-approved" class="filter-btn" type="button" onclick="filterProfileReviews('approved')">已通过</button>
      <button id="filter-rejected" class="filter-btn" type="button" onclick="filterProfileReviews('rejected')">已拒绝</button>
      <button id="filter-all" class="filter-btn" type="button" onclick="filterProfileReviews('all')">全部</button>
    </div>
    <p id="review-hint" class="review-hint">按用户聚合展示，头像和昵称通过审核后才会写入个人资料。</p>
  </div>

  <div id="loading" class="loading">
    <p>加载中...</p>
  </div>

  <div id="error" class="error" style="display:none">
    <p id="error-message">加载失败</p>
  </div>

  <div id="no-reviews" class="no-reviews" style="display:none">
    <p>暂无个人信息审核</p>
  </div>

  <div id="review-list" class="review-list" style="display:none"></div>
</div>

<script>
var profileReviewState = { filter: 'pending', changes: [], profiles: {}, busyId: '' }

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function formatDate(value) {
  if (!value) return '未知时间'
  return new Date(value).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

function setVisible(id, visible) {
  var el = document.getElementById(id)
  if (el) el.style.display = visible ? 'block' : 'none'
}

function statusText(status) {
  return { pending: '待审核', approved: '已通过', rejected: '已拒绝' }[status] || status || '待审核'
}

function statusClass(status) {
  return { pending: 'badge-pending', approved: 'badge-approved', rejected: 'badge-rejected' }[status] || 'badge-pending'
}

function showError(message) {
  setVisible('loading', false)
  setVisible('review-list', false)
  setVisible('no-reviews', false)
  setVisible('error', true)
  var errorMessage = document.getElementById('error-message')
  if (errorMessage) errorMessage.textContent = message
  console.error('Profile review error:', message)
}

function showNoReviews() {
  setVisible('loading', false)
  setVisible('error', false)
  setVisible('review-list', false)
  setVisible('no-reviews', true)
  var noReviews = document.getElementById('no-reviews')
  if (noReviews) {
    noReviews.innerHTML = '<p>' + ({
      pending: '暂无待审核个人信息',
      approved: '暂无已通过记录',
      rejected: '暂无已拒绝记录',
      all: '暂无个人信息审核'
    }[profileReviewState.filter] || '暂无个人信息审核') + '</p>'
  }
}

function countStatus(status) {
  return profileReviewState.changes.filter(function(change) { return (change.status || 'pending') === status }).length
}

function getFilteredChanges() {
  if (profileReviewState.filter === 'all') return profileReviewState.changes
  return profileReviewState.changes.filter(function(change) { return (change.status || 'pending') === profileReviewState.filter })
}

function groupByUser(changes) {
  var groups = {}
  changes.forEach(function(change) {
    var key = change.user_id || 'unknown'
    if (!groups[key]) groups[key] = []
    groups[key].push(change)
  })
  return Object.keys(groups).map(function(userId) {
    return { userId: userId, changes: groups[userId] }
  })
}

function getProfile(userId) {
  return profileReviewState.profiles[userId] || {}
}

function getName(profile, userId) {
  return profile.username || userId || '未知用户'
}

function getAvatar(profile) {
  return profile.avatar_url || '/SiteProject/images/default-avatar.svg'
}

function changeDiff(profile, change) {
  var rows = []
  var currentName = profile.username || ''
  var nextName = change.username || ''
  var currentAvatar = profile.avatar_url || ''
  var nextAvatar = change.avatar_url || ''
  var currentBio = profile.bio || ''
  var nextBio = change.bio || ''

  if (nextName && nextName !== currentName) {
    rows.push('<div class="diff-row"><span>昵称</span><strong>' + escapeHtml(currentName || '未设置') + '</strong><em>→</em><strong>' + escapeHtml(nextName) + '</strong></div>')
  }
  if (nextAvatar && nextAvatar !== currentAvatar) {
    rows.push('<div class="avatar-diff"><span>头像</span><img src="' + escapeHtml(currentAvatar || '/SiteProject/images/default-avatar.svg') + '" alt="当前头像"><em>→</em><img src="' + escapeHtml(nextAvatar) + '" alt="新头像"></div>')
  }
  if (nextBio !== currentBio) {
    rows.push('<div class="diff-row bio-diff"><span>简介</span><strong>' + escapeHtml(currentBio || '未填写') + '</strong><em>→</em><strong>' + escapeHtml(nextBio || '清空简介') + '</strong></div>')
  }

  return rows.length ? rows.join('') : '<p class="muted">这次提交与当前资料没有明显差异。</p>'
}

function renderStats(groups) {
  var pending = document.getElementById('stat-pending')
  var users = document.getElementById('stat-users')
  var approved = document.getElementById('stat-approved')
  var rejected = document.getElementById('stat-rejected')
  if (pending) pending.textContent = countStatus('pending')
  if (users) users.textContent = groups.length
  if (approved) approved.textContent = countStatus('approved')
  if (rejected) rejected.textContent = countStatus('rejected')
}

function renderProfileReviews() {
  var list = document.getElementById('review-list')
  if (!list) return

  var filtered = getFilteredChanges()
  var groups = groupByUser(filtered)
  renderStats(groupByUser(profileReviewState.changes))

  setVisible('loading', false)
  setVisible('error', false)
  setVisible('no-reviews', false)

  var hint = document.getElementById('review-hint')
  if (hint) {
    hint.textContent = profileReviewState.filter === 'pending'
      ? '按用户聚合展示，头像和昵称通过审核后才会写入个人资料。'
      : '当前显示：' + ({ approved: '已通过记录', rejected: '已拒绝记录', all: '全部记录' }[profileReviewState.filter] || '审核记录')
  }

  if (!groups.length) {
    showNoReviews()
    return
  }

  list.style.display = 'grid'
  list.innerHTML = groups.map(function(group) {
    var profile = getProfile(group.userId)
    var userName = escapeHtml(getName(profile, group.userId))
    var avatar = escapeHtml(getAvatar(profile))
    var role = escapeHtml(profile.role || 'member')
    var items = group.changes.map(function(change) {
      var status = change.status || 'pending'
      var busy = profileReviewState.busyId === change.id
      return [
        '<article class="change-card">',
        '  <div class="change-head">',
        '    <span class="badge ' + statusClass(status) + '">' + statusText(status) + '</span>',
        '    <span class="change-time">' + formatDate(change.created_at) + '</span>',
        '  </div>',
        '  <div class="diff-list">' + changeDiff(profile, change) + '</div>',
        '  <div class="change-actions">',
        status === 'pending' ? '    <button class="btn-success" type="button" onclick="approveProfileChange(\'' + change.id + '\')" ' + (busy ? 'disabled' : '') + '>通过</button>' : '',
        status === 'pending' ? '    <button class="btn-danger" type="button" onclick="rejectProfileChange(\'' + change.id + '\')" ' + (busy ? 'disabled' : '') + '>拒绝</button>' : '',
        '  </div>',
        '</article>'
      ].join('')
    }).join('')

    return [
      '<section class="user-review-card">',
      '  <header class="user-review-head">',
      '    <img src="' + avatar + '" alt="' + userName + '">',
      '    <div>',
      '      <h2>' + userName + '</h2>',
      '      <p>' + escapeHtml(group.userId) + '</p>',
      '    </div>',
      '    <span class="role-pill">' + role + '</span>',
      '  </header>',
      '  <div class="change-list">' + items + '</div>',
      '</section>'
    ].join('')
  }).join('')
}

function filterProfileReviews(filter) {
  profileReviewState.filter = filter
  Array.prototype.forEach.call(document.querySelectorAll('.filter-btn'), function(button) { button.classList.remove('active') })
  var active = document.getElementById('filter-' + filter)
  if (active) active.classList.add('active')
  renderProfileReviews()
}

async function waitForSupabase(maxAttempts) {
  maxAttempts = maxAttempts || 30
  for (var i = 0; i < maxAttempts; i++) {
    if (typeof window !== 'undefined' && window.__supabase) return window.__supabase
    await new Promise(function(resolve) { setTimeout(resolve, 100) })
  }
  return null
}

async function requireAdmin(supabase) {
  var sessionResult = await supabase.auth.getSession()
  var user = sessionResult && sessionResult.data && sessionResult.data.session && sessionResult.data.session.user

  if (!user || !user.id) {
    showError('请先登录管理员账号')
    return false
  }

  var profileResult = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .useServiceRole()
    .maybeSingle()

  if (profileResult.error) {
    showError('读取用户权限失败：' + profileResult.error.message)
    return false
  }

  if (!profileResult.data || profileResult.data.role !== 'admin') {
    showError('当前账号没有管理员权限')
    return false
  }

  return true
}

async function loadProfiles(supabase, userIds) {
  userIds = Array.from(new Set((userIds || []).filter(Boolean)))
  profileReviewState.profiles = {}
  if (!userIds.length) return

  var result = await supabase
    .from('profiles')
    .select('id, username, avatar_url, bio, role')
    .in('id', userIds)
    .useServiceRole()

  if (result.error) return
  ;(result.data || []).forEach(function(profile) {
    profileReviewState.profiles[profile.id] = profile
  })
}

async function loadProfileReviews() {
  setVisible('loading', true)
  setVisible('error', false)
  setVisible('no-reviews', false)
  setVisible('review-list', false)

  try {
    var supabase = await waitForSupabase()
    if (!supabase) {
      showError('Supabase 未加载，请刷新页面后重试')
      return
    }

    if (!await requireAdmin(supabase)) return

    var result = await supabase
      .from('profile_changes')
      .select('id, user_id, username, avatar_url, bio, status, created_at')
      .order('created_at', { ascending: false })
      .useServiceRole()

    if (result.error) {
      showError('数据库查询失败：' + result.error.message)
      return
    }

    profileReviewState.changes = result.data || []
    await loadProfiles(supabase, profileReviewState.changes.map(function(change) { return change.user_id }))
    renderProfileReviews()
  } catch (error) {
    showError('加载失败：' + (error.message || '未知错误'))
  }
}

async function updateChangeStatus(id, status) {
  var supabase = await waitForSupabase()
  if (!supabase) {
    alert('Supabase 未加载，请刷新页面后重试')
    return false
  }
  if (!await requireAdmin(supabase)) return false

  var result = await supabase
    .from('profile_changes')
    .update({ status: status })
    .eq('id', id)
    .select('id')
    .useServiceRole()

  if (result.error) {
    alert('操作失败：' + result.error.message)
    return false
  }

  if (!result.data || result.data.length === 0) {
    alert('操作失败：数据库没有更新任何审核记录')
    return false
  }

  return true
}

function findChange(id) {
  return profileReviewState.changes.find(function(change) { return change.id === id })
}

function setBusy(id, busy) {
  profileReviewState.busyId = busy ? id : ''
  Array.prototype.forEach.call(document.querySelectorAll('.change-actions button'), function(button) {
    button.disabled = !!busy
  })
}

async function approveProfileChange(id) {
  var change = findChange(id)
  if (!change) return alert('找不到这条审核记录，请刷新后重试')
  if (!confirm('确定通过该用户的个人信息修改吗？')) return

  setBusy(id, true)
  try {
    var supabase = await waitForSupabase()
    if (!supabase) {
      alert('Supabase 未加载，请刷新页面后重试')
      return
    }
    if (!await requireAdmin(supabase)) return

    var profile = getProfile(change.user_id)
    var updateData = {}
    if (change.username) updateData.username = change.username
    if (change.avatar_url) updateData.avatar_url = change.avatar_url
    if (Object.prototype.hasOwnProperty.call(change, 'bio')) updateData.bio = change.bio || ''

    if (!Object.keys(updateData).length) {
      alert('这条记录没有可写入的资料字段')
      return
    }

    var profileResult = await supabase
      .from('profiles')
      .update(updateData)
      .eq('id', change.user_id)
      .select('id')
      .useServiceRole()

    if (profileResult.error) {
      alert('写入资料失败：' + profileResult.error.message)
      return
    }

    if (!profileResult.data || profileResult.data.length === 0) {
      var insertData = Object.assign({ id: change.user_id, role: profile.role || 'member' }, updateData)
      profileResult = await supabase
        .from('profiles')
        .insert(insertData)
        .select('id')
        .useServiceRole()
      if (profileResult.error) {
        alert('创建资料失败：' + profileResult.error.message)
        return
      }
    }

    if (await updateChangeStatus(id, 'approved')) {
      alert('已通过，资料已更新')
      loadProfileReviews()
    }
  } catch (error) {
    alert('操作失败：' + (error.message || '未知错误'))
  } finally {
    setBusy(id, false)
  }
}

async function rejectProfileChange(id) {
  if (!confirm('确定拒绝这条个人信息修改吗？')) return
  setBusy(id, true)
  try {
    if (await updateChangeStatus(id, 'rejected')) {
      alert('已拒绝')
      loadProfileReviews()
    }
  } finally {
    setBusy(id, false)
  }
}

if (typeof window !== 'undefined') {
  window.loadProfileReviews = loadProfileReviews
  window.filterProfileReviews = filterProfileReviews
  window.approveProfileChange = approveProfileChange
  window.rejectProfileChange = rejectProfileChange
}

if (typeof document !== 'undefined') {
  setTimeout(loadProfileReviews, 100)
}
</script>

<style>
#profile-review-page {
  max-width: 1120px;
  margin: 0 auto;
  padding: 2rem;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 2rem;
}

.page-header h1,
.eyebrow {
  margin: 0;
}

.eyebrow {
  margin-bottom: 0.35rem;
  color: var(--vp-c-brand-1);
  font-size: 0.82rem;
  font-weight: 700;
}

.header-actions,
.filter-bar {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.admin-section-nav {
  display: flex;
  gap: 0.5rem;
  margin: -0.75rem 0 1.25rem;
  padding: 0.35rem;
  width: fit-content;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
}

.admin-section-nav a {
  padding: 0.45rem 0.8rem;
  border-radius: 6px;
  color: var(--vp-c-text-2);
  text-decoration: none;
  font-size: 0.9rem;
}

.admin-section-nav a.active {
  background: var(--vp-c-bg);
  color: var(--vp-c-brand-1);
  font-weight: 700;
}

.review-summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.85rem;
  margin-bottom: 1rem;
}

.summary-card {
  display: grid;
  gap: 0.25rem;
  padding: 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
}

.summary-card.urgent {
  border-color: rgba(245, 158, 11, 0.45);
  background: rgba(245, 158, 11, 0.09);
}

.summary-card strong {
  font-size: 1.35rem;
  line-height: 1;
}

.summary-card span,
.review-hint,
.change-time,
.user-review-head p,
.muted {
  color: var(--vp-c-text-2);
  font-size: 0.86rem;
}

.review-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.25rem;
  padding: 0.85rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
}

.review-hint {
  margin: 0;
}

.filter-btn,
.btn-secondary,
.btn-success,
.btn-danger {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 36px;
  padding: 0 0.85rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  cursor: pointer;
  font-size: 0.88rem;
  text-decoration: none;
}

.filter-btn.active {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-1);
  color: #fff;
}

.btn-success {
  border-color: #059669;
  background: #059669;
  color: #fff;
}

.btn-danger {
  border-color: #dc2626;
  background: #dc2626;
  color: #fff;
}

.btn-success:disabled,
.btn-danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.loading,
.error,
.no-reviews {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--vp-c-text-2);
}

.error p:first-child {
  color: #dc2626;
  font-weight: 700;
}

.review-list {
  display: grid;
  gap: 1rem;
}

.user-review-card {
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
  overflow: hidden;
}

.user-review-head {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 1rem;
  align-items: center;
  padding: 1rem;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}

.user-review-head img {
  width: 56px;
  height: 56px;
  border-radius: 999px;
  object-fit: cover;
}

.user-review-head h2 {
  margin: 0;
  font-size: 1.05rem;
}

.user-review-head p {
  margin: 0.25rem 0 0;
  word-break: break-all;
}

.role-pill,
.badge {
  display: inline-flex;
  align-items: center;
  min-height: 24px;
  padding: 0 0.6rem;
  border-radius: 999px;
  font-size: 0.78rem;
  white-space: nowrap;
}

.role-pill {
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
}

.badge-pending {
  background: #fef3c7;
  color: #92400e;
}

.badge-approved {
  background: #d1fae5;
  color: #065f46;
}

.badge-rejected {
  background: #fee2e2;
  color: #991b1b;
}

.change-list {
  display: grid;
  gap: 0.75rem;
  padding: 1rem;
}

.change-card {
  display: grid;
  gap: 0.85rem;
  padding: 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
}

.change-head,
.change-actions {
  display: flex;
  gap: 0.6rem;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}

.diff-list {
  display: grid;
  gap: 0.65rem;
}

.diff-row,
.avatar-diff {
  display: grid;
  grid-template-columns: 64px minmax(0, 1fr) 20px minmax(0, 1fr);
  gap: 0.75rem;
  align-items: center;
}

.diff-row span,
.avatar-diff span {
  color: var(--vp-c-text-2);
  font-size: 0.84rem;
}

.diff-row strong {
  min-width: 0;
  padding: 0.55rem 0.65rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  font-weight: 500;
  overflow-wrap: anywhere;
}

.diff-row em,
.avatar-diff em {
  color: var(--vp-c-text-3);
  font-style: normal;
  text-align: center;
}

.avatar-diff img {
  width: 64px;
  height: 64px;
  border-radius: 999px;
  object-fit: cover;
}

.bio-diff strong {
  min-height: 54px;
}

@media (max-width: 760px) {
  #profile-review-page {
    padding: 1rem;
  }

  .page-header,
  .review-toolbar {
    align-items: flex-start;
    flex-direction: column;
  }

  .review-summary {
    grid-template-columns: repeat(2, 1fr);
  }

  .user-review-head,
  .diff-row,
  .avatar-diff {
    grid-template-columns: 1fr;
  }

  .diff-row em,
  .avatar-diff em {
    text-align: left;
  }
}
</style>
