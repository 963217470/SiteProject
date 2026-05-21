import{c as d,S as o,j as r,m as c}from"./chunks/framework.DOPCDQAF.js";function l(t){return new Date(t).toLocaleDateString("zh-CN",{year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"})}function u(t){return{draft:"📝 草稿",pending:"⏳ 待审核",published:"✅ 已发布",rejected:"❌ 已拒绝"}[t]||t}function p(t){return{draft:"badge-draft",pending:"badge-pending",published:"badge-published",rejected:"badge-rejected"}[t]||"badge-draft"}function i(t){const s=document.getElementById("loading"),n=document.getElementById("error"),a=document.getElementById("error-message");s.style.display="none",n.style.display="block",a.textContent=t,console.error("Admin page error:",t)}function m(){const t=document.getElementById("loading"),s=document.getElementById("no-articles");t.style.display="none",s.style.display="block"}function g(t){const s=document.getElementById("loading"),n=document.getElementById("no-articles"),a=document.getElementById("articles-list");if(s.style.display="none",n.style.display="none",a.style.display="block",!t||t.length===0){m();return}a.innerHTML=t.map(e=>`
    <div class="article-card">
      <div class="article-content">
        <div class="article-header">
          <h2>${e.title}</h2>
          <span class="badge ${p(e.status)}">${u(e.status)}</span>
        </div>
        <div class="article-meta">
          <span>📅 ${l(e.created_at)}</span>
        </div>
        ${e.summary?`<p class="article-summary">${e.summary}</p>`:""}
        ${e.reject_reason?`<p class="reject-reason">❌ 拒绝原因: ${e.reject_reason}</p>`:""}
        <div class="article-actions">
          ${e.status==="pending"?`
            <button class="btn-success" onclick="publishArticle('${e.id}')">✅ 发布</button>
            <button class="btn-danger" onclick="showRejectModal('${e.id}', '${e.title}')">❌ 拒绝</button>
          `:""}
          ${e.status==="published"?`
            <button class="btn-danger" onclick="unpublishArticle('${e.id}')">⏪ 取消发布</button>
          `:""}
          ${e.status==="draft"||e.status==="rejected"?`
            <button class="btn-success" onclick="publishArticle('${e.id}')">✅ 发布</button>
          `:""}
          <button class="btn-secondary" onclick="viewArticle('${e.id}')">👁️ 查看</button>
          <button class="btn-danger" onclick="deleteArticle('${e.id}')">🗑️ 删除</button>
        </div>
      </div>
    </div>
  `).join("")}async function b(t=30){for(let s=0;s<t;s++){if(window.__supabase)return!0;await new Promise(n=>setTimeout(n,100))}return!1}async function y(){const t=document.getElementById("loading");t.style.display="block";try{if(!await b()){i("Supabase 未加载，请刷新页面重试");return}const n=window.__supabase,{data:a,error:e}=await n.from("articles").select("id, title, summary, status, created_at, reject_reason").order("created_at",{ascending:!1});if(e){i("数据库错误: "+e.message);return}g(a)}catch(s){i("加载失败: "+s.message)}}setTimeout(()=>{y()},100);const $=JSON.parse('{"title":"文章审核","description":"","frontmatter":{"title":"文章审核","layout":"page"},"headers":[],"relativePath":"admin/index.md","filePath":"admin/index.md"}'),f={name:"admin/index.md"};function _(t,s,n,a,e,h){return o(),r("div",null,[...s[0]||(s[0]=[c('<div id="admin-page"><div class="page-header"><h1>🛠️ 文章审核</h1><div class="header-actions"><a href="/SiteProject/articles" class="btn-secondary">返回文章列表</a></div></div><div id="loading" class="loading"><p>加载中...</p></div><div id="error" class="error" style="display:none;"><p id="error-message">加载失败</p></div><div id="no-articles" class="no-articles" style="display:none;"><p>暂无待审核文章</p></div><div id="articles-list" class="articles-list" style="display:none;"></div></div>',1)])])}const w=d(f,[["render",_]]);export{$ as __pageData,w as default};
