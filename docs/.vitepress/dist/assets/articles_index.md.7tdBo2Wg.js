import{c,S as u,j as f,g as i}from"./chunks/framework.DT_SM_aS.js";var o="all";function p(e){return new Date(e).toLocaleDateString("zh-CN",{year:"numeric",month:"long",day:"numeric"})}function m(e){return{public:"🌐 公开",internal:"🔒 内部"}[e]||e}function g(e){return{draft:"📝 草稿",pending:"⏳ 待审核",published:"✅ 已发布",rejected:"❌ 已拒绝"}[e]||e}function y(e){return{draft:"badge-draft",pending:"badge-pending",published:"badge-published",rejected:"badge-rejected"}[e]||"badge-draft"}function b(e){return e?e.substring(0,200)+(e.length>200?"...":""):""}function l(e){if(typeof document>"u")return;const n=document.getElementById("loading"),a=document.getElementById("error"),s=document.getElementById("error-message");n.style.display="none",a.style.display="block",s.textContent=e,console.error("Articles page error:",e)}function v(){if(typeof document>"u")return;const e=document.getElementById("loading"),n=document.getElementById("no-articles");e.style.display="none",n.style.display="block"}function h(e){if(typeof document>"u")return;const n=document.getElementById("loading"),a=document.getElementById("no-articles"),s=document.getElementById("articles-list");if(n.style.display="none",a.style.display="none",s.style.display="block",!e||e.length===0){v();return}s.innerHTML=e.map(t=>`
    <div class="article-card">
      ${t.cover_url?`<img src="${t.cover_url}" class="article-cover" alt="${t.title}" onerror="this.style.display='none'">`:""}
      <div class="article-content">
        <div class="article-header">
          <h2><a href="/SiteProject/article?id=${t.id}">${t.title}</a></h2>
          <span class="badge ${y(t.status)}">${g(t.status)}</span>
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
              ${t.tags.map(r=>`<span class="tag">#${r}</span>`).join("")}
            </div>
          `:"<div></div>"}
          <a class="view-article-btn" href="/SiteProject/article?id=${t.id}">查看文章</a>
        </div>
          </div>
    </div>
  `).join("")}async function w(e=30){for(let n=0;n<e;n++){if(typeof window<"u"&&window.__supabase)return!0;await new Promise(a=>setTimeout(a,100))}return!1}async function d(){if(typeof document>"u")return;const e=document.getElementById("loading");e.style.display="block";try{if(console.log("Waiting for Supabase..."),!await w()){l("Supabase 未加载，请刷新页面重试");return}console.log("Supabase loaded, fetching articles...");let s=window.__supabase.from("articles").select("id, title, summary, content, cover_url, tags, visibility, status, created_at, likes_count, comments_count").order("created_at",{ascending:!1});o!=="all"&&(s=s.eq("status",o));const{data:t,error:r}=await s;if(r){console.error("Database error:",r),l("数据库错误: "+r.message);return}console.log("Articles loaded:",t),h(t)}catch(n){console.error("Unexpected error:",n),l("加载失败: "+n.message)}}function _(e){typeof document>"u"||(o=e,document.querySelectorAll(".filter-btn").forEach(n=>n.classList.remove("active")),document.getElementById("filter-"+e).classList.add("active"),d())}typeof window<"u"&&(window.filterArticles=_,window.loadArticles=d);typeof document<"u"&&setTimeout(()=>{d()},100);const k=JSON.parse('{"title":"文章列表","description":"","frontmatter":{"title":"文章列表","layout":"page"},"headers":[],"relativePath":"articles/index.md","filePath":"articles/index.md"}'),$={name:"articles/index.md"};function A(e,n,a,s,t,r){return u(),f("div",null,[...n[0]||(n[0]=[i("div",{id:"articles-page"},[i("div",{class:"page-header"},[i("h1",null,"📚 文章列表"),i("div",{class:"filter-bar"},[i("button",{id:"filter-all",class:"filter-btn active",onclick:"if(typeof document !== 'undefined') filterArticles('all')"},"全部"),i("button",{id:"filter-published",class:"filter-btn",onclick:"if(typeof document !== 'undefined') filterArticles('published')"},"已发布"),i("button",{id:"filter-pending",class:"filter-btn",onclick:"if(typeof document !== 'undefined') filterArticles('pending')"},"待审核"),i("button",{id:"filter-draft",class:"filter-btn",onclick:"if(typeof document !== 'undefined') filterArticles('draft')"},"草稿"),i("button",{id:"filter-rejected",class:"filter-btn",onclick:"if(typeof document !== 'undefined') filterArticles('rejected')"},"已拒绝")])]),i("div",{id:"loading",class:"loading"},[i("p",null,"加载中..."),i("p",{class:"loading-hint"},"如果长时间没有响应，请检查浏览器控制台")]),i("div",{id:"error",class:"error",style:{display:"none"}},[i("p",{id:"error-message"},"加载失败，请刷新页面重试")]),i("div",{id:"no-articles",class:"no-articles",style:{display:"none"}},[i("p",null,"暂无文章"),i("p",null,[i("a",{href:"/SiteProject/editor",class:"link"},"去发布第一篇文章")])]),i("div",{id:"articles-list",class:"articles-list",style:{display:"none"}})],-1)])])}const B=c($,[["render",A]]);export{k as __pageData,B as default};
