---
title: API 测试
layout: page
---

<script>
async function testApi() {
  const statusDiv = document.getElementById('status')
  statusDiv.innerHTML = ''
  
  try {
    const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplbnJnend3b3dnZnFid2NvemJpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODgwNjM1NCwiZXhwIjoyMDk0MzgyMzU0fQ.-qioHuE8nqf-9fhwNsJmh0fPlMSt7ysc0LtFlxulh6s'
    
    statusDiv.innerHTML += '<p>🔑 API Key: ' + API_KEY.substring(0, 20) + '...</p>'
    
    // 使用 service_role 密钥绕过 RLS
    statusDiv.innerHTML += '<p><strong>测试: 使用 service_role 密钥插入文章</strong></p>'
    
    const insert = await fetch('https://jenrgzwwowgfqbwcozbi.supabase.co/rest/v1/articles', {
      method: 'POST',
      headers: {
        'apikey': API_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify({
        title: '测试文章 ' + Date.now(),
        content: '测试内容',
        status: 'pending',
        visibility: 'public'
      })
    })
    
    statusDiv.innerHTML += '<p>📡 状态码: ' + insert.status + ' (' + insert.statusText + ')</p>'
    
    const responseText = await insert.text()
    statusDiv.innerHTML += '<p>📄 响应: ' + responseText + '</p>'
    
    if (insert.ok) {
      statusDiv.innerHTML += '<p style="color: green; font-weight: bold;">✅ 插入成功！</p>'
    } else {
      statusDiv.innerHTML += '<p style="color: red; font-weight: bold;">❌ 插入失败</p>'
      
      // 检查是否是 RLS 问题
      if (responseText.includes('row-level security')) {
        statusDiv.innerHTML += '<p>💡 提示: 这是 RLS 策略问题。虽然使用了 service_role 密钥，但可能需要检查：</p>'
        statusDiv.innerHTML += '<ul>'
        statusDiv.innerHTML += '<li>1. 表是否启用了 RLS</li>'
        statusDiv.innerHTML += '<li>2. service_role 是否有绕过 RLS 的权限</li>'
        statusDiv.innerHTML += '<li>3. 是否需要在请求中添加 Authorization header</li>'
        statusDiv.innerHTML += '</ul>'
      }
    }
    
  } catch (e) {
    statusDiv.innerHTML += '<p style="color: red;">❌ 异常: ' + e.message + '</p>'
    console.error(e)
  }
}
</script>

<h1>API 测试页面</h1>

<button onclick="testApi()" style="padding: 10px 20px; background: #8B0000; color: white; border: none; border-radius: 4px; cursor: pointer;">
  开始测试
</button>

<div id="status" style="margin-top: 20px; padding: 15px; border: 1px solid #ddd; border-radius: 4px; font-family: monospace; font-size: 12px;">
  点击按钮开始测试...
</div>
