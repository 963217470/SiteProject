import{c as d,S as r,j as c,g as s}from"./chunks/framework.DOPCDQAF.js";function l(t){return new Date(t).toLocaleDateString("zh-CN",{year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"})}function u(t){return{draft:"📝 草稿",pending:"⏳ 待审核",published:"✅ 已发布",rejected:"❌ 已拒绝"}[t]||t}function p(t){return{draft:"badge-draft",pending:"badge-pending",published:"badge-published",rejected:"badge-rejected"}[t]||"badge-draft"}function i(t){if(typeof document>"u")return;const n=document.getElementById("loading"),a=document.getElementById("error"),o=document.getElementById("error-message");n.style.display="none",a.style.display="block",o.textContent=t,console.error("Admin page error:",t)}function m(){if(typeof document>"u")return;const t=document.getElementById("loading"),n=document.getElementById("no-articles");t.style.display="none",n.style.display="block"}function g(t){if(typeof document>"u")return;const n=document.getElementById("loading"),a=document.getElementById("no-articles"),o=document.getElementById("articles-list");if(n.style.display="none",a.style.display="none",o.style.display="block",!t||t.length===0){m();return}o.innerHTML=t.map(e=>`
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
            <button class="btn-warning" onclick="unpublishArticle('${e.id}')">⏪ 取消发布</button>
          `:""}
          ${e.status==="draft"||e.status==="rejected"?`
            <button class="btn-success" onclick="publishArticle('${e.id}')">✅ 发布</button>
          `:""}
          <button class="btn-secondary" onclick="viewArticle('${e.id}')">👁️ 查看</button>
          <button class="btn-danger" onclick="deleteArticle('${e.id}')">🗑️ 删除</button>
        </div>
      </div>
    </div>
  `).join("")}async function y(t=30){for(let n=0;n<t;n++){if(typeof window<"u"&&window.__supabase)return!0;await new Promise(a=>setTimeout(a,100))}return!1}async function f(){if(typeof document>"u")return;const t=document.getElementById("loading");t.style.display="block";try{if(!await y()){i("Supabase 未加载，请刷新页面重试");return}const a=window.__supabase,{data:o,error:e}=await a.from("articles").select("id, title, summary, status, created_at, reject_reason").order("created_at",{ascending:!1});if(e){i("数据库错误: "+e.message);return}g(o)}catch(n){i("加载失败: "+n.message)}}typeof document<"u"&&setTimeout(()=>{f()},100);const w=JSON.parse('{"title":"文章审核","description":"","frontmatter":{"title":"文章审核","layout":"page"},"headers":[],"relativePath":"admin/index.md","filePath":"admin/index.md"}'),b={name:"admin/index.md"};function h(t,n,a,o,e,$){return r(),c("div",null,[...n[0]||(n[0]=[s("div",{id:"admin-page"},[s("div",{class:"page-header"},[s("h1",null,"🛠️ 文章审核"),s("div",{class:"header-actions"},[s("button",{class:"btn-secondary",onclick:"testConnection()"},"🔧 测试连接"),s("button",{class:"btn-secondary",onclick:"fixPermissions()"},"🔓 修复权限"),s("a",{href:"/SiteProject/articles",class:"btn-secondary"},"返回文章列表")])]),s("div",{id:"loading",class:"loading"},[s("p",null,"加载中...")]),s("div",{id:"error",class:"error",style:{display:"none"}},[s("p",{id:"error-message"},"加载失败")]),s("div",{id:"no-articles",class:"no-articles",style:{display:"none"}},[s("p",null,"暂无待审核文章")]),s("div",{id:"articles-list",class:"articles-list",style:{display:"none"}})],-1)])])}const _=d(b,[["render",h]]);export{w as __pageData,_ as default};
