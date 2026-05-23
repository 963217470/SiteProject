import{c as d,S as u,j as f,g as s}from"./chunks/framework.DT_SM_aS.js";var o="all";function p(e){return new Date(e).toLocaleDateString("zh-CN",{year:"numeric",month:"long",day:"numeric"})}function m(e){return{public:"🌐 公开",internal:"🔒 内部"}[e]||e}function y(e){return{published:"✅ 已发布"}[e]||e}function g(e){return{published:"badge-published"}[e]||"badge-draft"}function b(e){return e?e.substring(0,200)+(e.length>200?"...":""):""}function r(e){if(typeof document>"u")return;const n=document.getElementById("loading"),a=document.getElementById("error"),i=document.getElementById("error-message");n.style.display="none",a.style.display="block",i.textContent=e,console.error("Articles page error:",e)}function v(){if(typeof document>"u")return;const e=document.getElementById("loading"),n=document.getElementById("no-articles");e.style.display="none",n.style.display="block"}function h(e){if(typeof document>"u")return;const n=document.getElementById("loading"),a=document.getElementById("no-articles"),i=document.getElementById("articles-list");if(n.style.display="none",a.style.display="none",i.style.display="block",!e||e.length===0){v();return}i.innerHTML=e.map(t=>`
    <div class="article-card">
      ${t.cover_url?`<img src="${t.cover_url}" class="article-cover" alt="${t.title}" onerror="this.style.display='none'">`:""}
      <div class="article-content">
        <div class="article-header">
          <h2><a href="/SiteProject/article?id=${t.id}">${t.title}</a></h2>
          <span class="badge ${g(t.status)}">${y(t.status)}</span>
        </div>
        <p class="article-summary">${t.summary||b(t.content)}</p>
        <div class="article-meta">
          <span class="meta-item">📅 ${p(t.created_at)}</span>
          <span class="meta-item">${m(t.visibility)}</span>
          <span class="meta-item">❤️ ${t.likes_count||0}</span>
          <span class="meta-item">💬 ${t.comments_count||0}</span>
        </div>
        <div class="article-footer">
          ${t.tags&&t.tags.length>0?`
            <div class="article-tags">
              ${t.tags.map(l=>`<span class="tag">#${l}</span>`).join("")}
            </div>
          `:"<div></div>"}
          <a class="view-article-btn" href="/SiteProject/article?id=${t.id}">查看文章</a>
        </div>
          </div>
    </div>
  `).join("")}async function w(e=30){for(let n=0;n<e;n++){if(typeof window<"u"&&window.__supabase)return!0;await new Promise(a=>setTimeout(a,100))}return!1}async function c(){if(typeof document>"u")return;const e=document.getElementById("loading");e.style.display="block";try{if(console.log("Waiting for Supabase..."),!await w()){r("Supabase 未加载，请刷新页面重试");return}console.log("Supabase loaded, fetching articles...");let i=window.__supabase.from("articles").select("id, title, summary, content, cover_url, tags, visibility, status, created_at, likes_count, comments_count").eq("status","published").order("created_at",{ascending:!1});o!=="all"&&(i=i.eq("visibility",o));const{data:t,error:l}=await i;if(l){console.error("Database error:",l),r("数据库错误: "+l.message);return}console.log("Articles loaded:",t),h(t)}catch(n){console.error("Unexpected error:",n),r("加载失败: "+n.message)}}function _(e){typeof document>"u"||(o=e,document.querySelectorAll(".filter-btn").forEach(n=>n.classList.remove("active")),document.getElementById("filter-"+e).classList.add("active"),c())}typeof window<"u"&&(window.filterArticles=_,window.loadArticles=c);typeof document<"u"&&setTimeout(()=>{c()},100);const B=JSON.parse('{"title":"文章列表","description":"","frontmatter":{"title":"文章列表","layout":"page"},"headers":[],"relativePath":"articles/index.md","filePath":"articles/index.md"}'),$={name:"articles/index.md"};function A(e,n,a,i,t,l){return u(),f("div",null,[...n[0]||(n[0]=[s("div",{id:"articles-page"},[s("div",{class:"page-header"},[s("h1",null,"📚 文章列表"),s("div",{class:"filter-bar"},[s("button",{id:"filter-all",class:"filter-btn active",onclick:"if(typeof document !== 'undefined') filterArticles('all')"},"全部"),s("button",{id:"filter-public",class:"filter-btn",onclick:"if(typeof document !== 'undefined') filterArticles('public')"},"公开"),s("button",{id:"filter-internal",class:"filter-btn",onclick:"if(typeof document !== 'undefined') filterArticles('internal')"},"内部")])]),s("div",{id:"loading",class:"loading"},[s("p",null,"加载中..."),s("p",{class:"loading-hint"},"如果长时间没有响应，请检查浏览器控制台")]),s("div",{id:"error",class:"error",style:{display:"none"}},[s("p",{id:"error-message"},"加载失败，请刷新页面重试")]),s("div",{id:"no-articles",class:"no-articles",style:{display:"none"}},[s("p",null,"暂无文章"),s("p",null,[s("a",{href:"/SiteProject/editor",class:"link"},"去发布第一篇文章")])]),s("div",{id:"articles-list",class:"articles-list",style:{display:"none"}})],-1)])])}const E=d($,[["render",A]]);export{B as __pageData,E as default};
