---
title: 调试用户信息
layout: page
---

<div class="debug-container">
  <h1>🔍 用户信息调试</h1>
  <p class="desc">查看您的用户数据和角色信息</p>
  
  <div id="loading" class="loading" style="display: none;">加载中...</div>
  <div id="initial-message" class="loading">正在初始化...</div>
  
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
      <button class="btn" id="refresh-btn">刷新</button>
      <button class="btn btn-secondary" id="copy-btn">复制用户ID</button>
    </div>
  </div>
  
  <div id="error" class="error" style="display: none;"></div>
</div>

<script>
// 只有在客户端执行
if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  let currentUserId = null;
  let refreshButton = null;
  let copyButton = null;

  function refresh() {
    const loadingEl = document.getElementById('loading');
    const userInfoEl = document.getElementById('user-info');
    const errorEl = document.getElementById('error');
    const initialMsgEl = document.getElementById('initial-message');
    
    if (!loadingEl || !userInfoEl || !errorEl) {
      console.error('找不到DOM元素');
      return;
    }
    
    loadingEl.style.display = 'block';
    userInfoEl.style.display = 'none';
    errorEl.style.display = 'none';
    if (initialMsgEl) initialMsgEl.style.display = 'none';
    
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
      const userDataEl = document.getElementById('user-data');
      const userIdEl = document.getElementById('user-id');
      
      if (userDataEl) userDataEl.textContent = JSON.stringify(user, null, 2);
      if (userIdEl) userIdEl.textContent = user.id;
      
      // 获取profile信息
      return window.__supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
        
    }).then(function(result) {
      const profile = result.data;
      const profileDataEl = document.getElementById('profile-data');
      const userRoleEl = document.getElementById('user-role');
      const userStatusEl = document.getElementById('user-status');
      
      if (profile) {
        if (profileDataEl) profileDataEl.textContent = JSON.stringify(profile, null, 2);
        if (userRoleEl) {
          userRoleEl.textContent = profile.role || '未设置';
          userRoleEl.className = 'role-tag ' + (profile.role || '');
        }
        
        if (userStatusEl) {
          if (profile.role === 'admin') {
            userStatusEl.textContent = '✅ 您是管理员！';
            userStatusEl.className = 'status success';
          } else {
            userStatusEl.textContent = '⚠️ 您不是管理员';
            userStatusEl.className = 'status warning';
          }
        }
      } else {
        if (profileDataEl) profileDataEl.textContent = '暂无profile记录，需要先设置！';
        if (userRoleEl) {
          userRoleEl.textContent = '未设置';
          userRoleEl.className = 'role-tag';
        }
        if (userStatusEl) {
          userStatusEl.textContent = '⚠️ 没有profile记录';
          userStatusEl.className = 'status warning';
        }
      }
      
      loadingEl.style.display = 'none';
      userInfoEl.style.display = 'block';
      
    }).catch(function(e) {
      console.error(e);
      showError('获取profile信息失败: ' + e.message);
    });
  }

  function showError(msg) {
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    const userInfoEl = document.getElementById('user-info');
    const initialMsgEl = document.getElementById('initial-message');
    
    if (loadingEl) loadingEl.style.display = 'none';
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.style.display = 'block';
    }
    if (userInfoEl) userInfoEl.style.display = 'none';
    if (initialMsgEl) initialMsgEl.style.display = 'none';
  }

  function copyToClipboard() {
    if (currentUserId) {
      navigator.clipboard.writeText(currentUserId).then(function() {
        alert('用户ID已复制到剪贴板！');
      });
    }
  }

  // 等待DOM加载完成
  document.addEventListener('DOMContentLoaded', function() {
    refreshButton = document.getElementById('refresh-btn');
    copyButton = document.getElementById('copy-btn');
    
    if (refreshButton) {
      refreshButton.addEventListener('click', refresh);
    }
    
    if (copyButton) {
      copyButton.addEventListener('click', copyToClipboard);
    }
    
    // 延迟一点执行让Supabase加载完成
    setTimeout(refresh, 300);
  });
  
  // 如果DOM已加载，立即执行
  if (document.readyState !== 'loading') {
    setTimeout(function() {
      refreshButton = document.getElementById('refresh-btn');
      copyButton = document.getElementById('copy-btn');
      
      if (refreshButton) refreshButton.addEventListener('click', refresh);
      if (copyButton) copyButton.addEventListener('click', copyToClipboard);
      
      setTimeout(refresh, 300);
    }, 100);
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
