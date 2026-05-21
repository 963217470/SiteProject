---
title: 调试用户信息
layout: page
---

<div class="debug-container">
  <h1>🔍 用户信息调试</h1>
  <p class="desc">查看您的用户数据和角色信息</p>
  
  <div id="loading" class="loading">加载中...</div>
  
  <div id="user-info" style="display: none;">
    <h2>您的用户信息</h2>
    <pre id="user-data" class="data-box"></pre>
    
    <h2>您的Profile信息</h2>
    <pre id="profile-data" class="data-box"></pre>
    
    <div class="status-box">
      <p><strong>用户ID:</strong> <span id="user-id"></span></p>
      <p><strong>角色:</strong> <span id="user-role"></span></p>
      <p><strong>状态:</strong> <span id="user-status"></span></p>
    </div>
    
    <div class="actions">
      <button class="btn" onclick="refresh()">刷新</button>
      <button class="btn btn-secondary" onclick="copyToClipboard()">复制用户ID</button>
    </div>
  </div>
  
  <div id="error" class="error" style="display: none;"></div>
</div>

<script>
if (typeof window !== 'undefined') {
  let currentUserId = null;

  function refresh() {
    document.getElementById('loading').style.display = 'block';
    document.getElementById('user-info').style.display = 'none';
    document.getElementById('error').style.display = 'none';
    
    if (!window.__supabase) {
      showError('Supabase未加载，请刷新页面');
      return;
    }
    
    window.__supabase.auth.getSession().then(function(r) {
      if (!r.data || !r.data.session) {
        showError('您还未登录，请先登录');
        return;
      }
      
      const user = r.data.session.user;
      currentUserId = user.id;
      
      // 显示用户基本信息
      document.getElementById('user-data').textContent = JSON.stringify(user, null, 2);
      document.getElementById('user-id').textContent = user.id;
      
      // 获取profile信息
      return window.__supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
        
    }).then(function(result) {
      const profile = result.data;
      
      if (profile) {
        document.getElementById('profile-data').textContent = JSON.stringify(profile, null, 2);
        document.getElementById('user-role').textContent = profile.role || '未设置';
        document.getElementById('user-role').className = 'role-tag ' + profile.role;
        
        if (profile.role === 'admin') {
          document.getElementById('user-status').textContent = '✅ 您是管理员！';
          document.getElementById('user-status').className = 'status success';
        } else {
          document.getElementById('user-status').textContent = '⚠️ 您不是管理员';
          document.getElementById('user-status').className = 'status warning';
        }
      } else {
        document.getElementById('profile-data').textContent = '暂无profile记录，需要先设置！';
        document.getElementById('user-role').textContent = '未设置';
        document.getElementById('user-role').className = 'role-tag';
        document.getElementById('user-status').textContent = '⚠️ 没有profile记录';
        document.getElementById('user-status').className = 'status warning';
      }
      
      document.getElementById('loading').style.display = 'none';
      document.getElementById('user-info').style.display = 'block';
      
    }).catch(function(e) {
      console.error(e);
      showError('获取profile信息失败: ' + e.message);
    });
  }

  function showError(msg) {
    document.getElementById('loading').style.display = 'none';
    document.getElementById('error').textContent = msg;
    document.getElementById('error').style.display = 'block';
  }

  function copyToClipboard() {
    if (currentUserId) {
      navigator.clipboard.writeText(currentUserId).then(function() {
        alert('用户ID已复制到剪贴板！');
      });
    }
  }

  // 页面加载时自动刷新
  setTimeout(refresh, 100);
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

.status-box {
  background: #fff;
  padding: 1.5rem;
  border-radius: 8px;
  margin: 1.5rem 0;
  border: 1px solid #e5e7eb;
}

.status-box p {
  margin: 0.75rem 0;
}

.role-tag {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-size: 0.9rem;
  background: #e5e7eb;
  color: #374151;
}

.role-tag.admin {
  background: linear-gradient(135deg, #f59e0b, #d97706);
  color: white;
  font-weight: 600;
}

.role-tag.member {
  background: #dbeafe;
  color: #1e40af;
}

.role-tag.user {
  background: #e5e7eb;
  color: #374151;
}

.status {
  font-weight: 600;
}

.status.success {
  color: #059669;
}

.status.warning {
  color: #d97706;
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
