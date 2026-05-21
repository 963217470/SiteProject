---
title: 调试用户信息
layout: page
---

<div class="debug-container">
  <h1>🔍 您的用户信息</h1>
  <p class="desc">查看您 GitHub 登录后在 Supabase 中的用户数据</p>
  
  <div id="loading" class="loading">加载中...</div>
  
  <div id="user-info" style="display: none;">
    <h2>您的用户信息：</h2>
    <pre id="user-data" class="data-box"></pre>
    
    <h2>元数据详情：</h2>
    <pre id="meta-data" class="data-box"></pre>
    
    <div class="actions">
      <button class="btn" onclick="refresh()">刷新</button>
      <button class="btn btn-secondary" onclick="copyToClipboard()">复制用户 ID</button>
    </div>
  </div>
  
  <div id="error" class="error" style="display: none;"></div>
</div>

<script>
if (typeof window !== 'undefined') {
  const supabase = window.__supabase;

  function refresh() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('user-info').style.display = 'none';
    document.getElementById('error').style.display = 'none';
    
    if (!supabase) {
      showError('Supabase 未加载，请刷新页面');
      return;
    }
    
    supabase.auth.getSession().then(function(r) {
      if (!r.data || !r.data.session) {
        showError('您还未登录，请先登录');
        return;
      }
      
      const user = r.data.session.user;
      document.getElementById('user-data').textContent = JSON.stringify(user, null, 2);
      document.getElementById('meta-data').textContent = JSON.stringify(user.user_metadata, null, 2);
      
      document.getElementById('loading').style.display = 'none';
      document.getElementById('user-info').style.display = 'block';
    }).catch(function(e) {
      showError('获取用户信息失败: ' + e.message);
    });
  }

  function showError(msg) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').textContent = msg;
    document.getElementById('error').style.display = 'block';
  }

  function copyToClipboard() {
    if (!supabase) return;
    supabase.auth.getSession().then(function(r) {
      if (r.data && r.data.session) {
        const id = r.data.session.user.id;
        navigator.clipboard.writeText(id).then(function() {
          alert('用户 ID 已复制到剪贴板！\nID: ' + id);
        });
      }
    });
  }

  if (typeof document !== 'undefined') {
    setTimeout(refresh, 100);
  }
}
</script>

<style>
.debug-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.desc {
  color: var(--vp-c-text-2);
  margin-bottom: 2rem;
}

.loading, .error {
  text-align: center;
  padding: 2rem;
  font-size: 1.2rem;
}

.error {
  color: #dc2626;
  background: #fee2e2;
  border-radius: 8px;
}

.data-box {
  background: #f3f4f6;
  padding: 1rem;
  border-radius: 8px;
  overflow: auto;
  font-size: 0.85rem;
  border: 1px solid #e5e7eb;
}

.actions {
  margin-top: 2rem;
  display: flex;
  gap: 1rem;
}

.btn {
  padding: 0.75rem 1.5rem;
  background: var(--vp-c-brand-1);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
}

.btn-secondary {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  border: 1px solid var(--vp-c-divider);
}
</style>
