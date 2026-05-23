import{c as u,S as p,j as f,g as s}from"./chunks/framework.DT_SM_aS.js";var o="all";function m(e){return new Date(e).toLocaleDateString("zh-CN",{year:"numeric",month:"long",day:"numeric"})}function g(e){return{public:"🌐 公开",internal:"🔒 内部"}[e]||e}function y(e){return{published:"✅ 已发布"}[e]||e}function b(e){return{published:"badge-published"}[e]||"badge-draft"}function v(e){return e?e.replace(/!\[[^\]]*\]\([^)]+\)/g," ").replace(/https?:\/\/\S+\.(png|jpe?g|gif|webp)(\?\S*)?/gi," ").replace(/[#>*_`~\[\]()]/g," ").replace(/\s+/g," ").trim().substring(0,140)+(e.length>200?"...":""):""}function h(e){if(e.cover_url)return e.cover_url;const t=String(e.content||"").match(/!\[[^\]]*\]\((https?:\/\/[^)\s]+|data:image\/[^)]+)\)/i);return t?t[1]:""}function l(e){if(typeof document>"u")return;const t=document.getElementById("loading"),a=document.getElementById("error"),i=document.getElementById("error-message");t.style.display="none",a.style.display="block",i.textContent=e,console.error("Articles page error:",e)}function w(){if(typeof document>"u")return;const e=document.getElementById("loading"),t=document.getElementById("no-articles");e.style.display="none",t.style.display="block"}function _(e){if(typeof document>"u")return;const t=document.getElementById("loading"),a=document.getElementById("no-articles"),i=document.getElementById("articles-list");if(t.style.display="none",a.style.display="none",i.style.display="block",!e||e.length===0){w();return}i.innerHTML=e.map(n=>{const r=h(n);return`
    <div class="article-card">
      ${r?`<img src="${r}" class="article-cover" alt="${n.title}" onerror="this.style.display='none'">`:""}
      <div class="article-content">
        <div class="article-header">
          <h2><a href="/SiteProject/article?id=${n.id}">${n.title}</a></h2>
          <span class="badge ${b(n.status)}">${y(n.status)}</span>
        </div>
        <p class="article-summary">${n.summary||v(n.content)}</p>
        <div class="article-meta">
          <span class="meta-item">📅 ${m(n.created_at)}</span>
          <span class="meta-item">${g(n.visibility)}</span>
          <span class="meta-item">❤️ ${n.likes_count||0}</span>
          <span class="meta-item">💬 ${n.comments_count||0}</span>
        </div>
        <div class="article-footer">
          ${n.tags&&n.tags.length>0?`
            <div class="article-tags">
              ${n.tags.map(d=>`<span class="tag">#${d}</span>`).join("")}
            </div>
          `:"<div></div>"}
          <a class="view-article-btn" href="/SiteProject/article?id=${n.id}">查看文章</a>
        </div>
          </div>
    </div>
  `}).join("")}async function $(e=30){for(let t=0;t<e;t++){if(typeof window<"u"&&window.__supabase)return!0;await new Promise(a=>setTimeout(a,100))}return!1}async function c(){if(typeof document>"u")return;const e=document.getElementById("loading");e.style.display="block";try{if(console.log("Waiting for Supabase..."),!await $()){l("Supabase 未加载，请刷新页面重试");return}console.log("Supabase loaded, fetching articles...");let i=window.__supabase.from("articles").select("id, title, summary, content, cover_url, tags, visibility, status, created_at, likes_count, comments_count").eq("status","published").order("created_at",{ascending:!1});o!=="all"&&(i=i.eq("visibility",o));const{data:n,error:r}=await i;if(r){console.error("Database error:",r),l("数据库错误: "+r.message);return}console.log("Articles loaded:",n),_(n)}catch(t){console.error("Unexpected error:",t),l("加载失败: "+t.message)}}function S(e){typeof document>"u"||(o=e,document.querySelectorAll(".filter-btn").forEach(t=>t.classList.remove("active")),document.getElementById("filter-"+e).classList.add("active"),c())}typeof window<"u"&&(window.filterArticles=S,window.loadArticles=c);typeof document<"u"&&setTimeout(()=>{c()},100);const k=JSON.parse('{"title":"文章列表","description":"","frontmatter":{"title":"文章列表","layout":"page"},"headers":[],"relativePath":"articles/index.md","filePath":"articles/index.md"}'),A={name:"articles/index.md"};function B(e,t,a,i,n,r){return p(),f("div",null,[...t[0]||(t[0]=[s("div",{id:"articles-page"},[s("div",{class:"page-header"},[s("h1",null,"📚 文章列表"),s("div",{class:"filter-bar"},[s("button",{id:"filter-all",class:"filter-btn active",onclick:"if(typeof document !== 'undefined') filterArticles('all')"},"全部"),s("button",{id:"filter-public",class:"filter-btn",onclick:"if(typeof document !== 'undefined') filterArticles('public')"},"公开"),s("button",{id:"filter-internal",class:"filter-btn",onclick:"if(typeof document !== 'undefined') filterArticles('internal')"},"内部")])]),s("div",{id:"loading",class:"loading"},[s("p",null,"加载中..."),s("p",{class:"loading-hint"},"如果长时间没有响应，请检查浏览器控制台")]),s("div",{id:"error",class:"error",style:{display:"none"}},[s("p",{id:"error-message"},"加载失败，请刷新页面重试")]),s("div",{id:"no-articles",class:"no-articles",style:{display:"none"}},[s("p",null,"暂无文章"),s("p",null,[s("a",{href:"/SiteProject/editor",class:"link"},"去发布第一篇文章")])]),s("div",{id:"articles-list",class:"articles-list",style:{display:"none"}})],-1)])])}const x=u(A,[["render",B]]);export{k as __pageData,x as default};
