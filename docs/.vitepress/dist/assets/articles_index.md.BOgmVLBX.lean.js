import{c as o,S as d,j as c,g as n}from"./chunks/framework.DOPCDQAF.js";var u="all";function p(e){return new Date(e).toLocaleDateString("zh-CN",{year:"numeric",month:"long",day:"numeric"})}function f(e){return{public:"🌐 公开",internal:"🔒 内部"}[e]||e}function m(e){return{draft:"📝 草稿",pending:"⏳ 待审核",published:"✅ 已发布",rejected:"❌ 已拒绝"}[e]||e}function g(e){return{draft:"badge-draft",pending:"badge-pending",published:"badge-published",rejected:"badge-rejected"}[e]||"badge-draft"}function y(e){return e?e.substring(0,200)+(e.length>200?"...":""):""}function l(e){if(typeof document>"u")return;const s=document.getElementById("loading"),i=document.getElementById("error"),a=document.getElementById("error-message");s.style.display="none",i.style.display="block",a.textContent=e,console.error("Articles page error:",e)}function b(){if(typeof document>"u")return;const e=document.getElementById("loading"),s=document.getElementById("no-articles");e.style.display="none",s.style.display="block"}function v(e){if(typeof document>"u")return;const s=document.getElementById("loading"),i=document.getElementById("no-articles"),a=document.getElementById("articles-list");if(s.style.display="none",i.style.display="none",a.style.display="block",!e||e.length===0){b();return}a.innerHTML=e.map(t=>`
    <div class="article-card">
      ${t.cover_url?`<img src="${t.cover_url}" class="article-cover" alt="${t.title}" onerror="this.style.display='none'">`:""}
      <div class="article-content">
        <div class="article-header">
          <h2><a href="/SiteProject/article?id=${t.id}">${t.title}</a></h2>
          <span class="badge ${g(t.status)}">${m(t.status)}</span>
        </div>
        <p class="article-summary">${t.summary||y(t.content)}</p>
        <div class="article-meta">
          <span class="meta-item">📅 ${p(t.created_at)}</span>
          <span class="meta-item">${f(t.visibility)}</span>
          <span class="meta-item">❤️ ${t.likes_count||0}</span>
          <span class="meta-item">💬 ${t.comments_count||0}</span>
        </div>
        ${t.tags&&t.tags.length>0?`
          <div class="article-tags">
            ${t.tags.map(r=>`<span class="tag">#${r}</span>`).join("")}
          </div>
        `:""}
      </div>
    </div>
  `).join("")}async function h(e=30){for(let s=0;s<e;s++){if(typeof window<"u"&&window.__supabase)return!0;await new Promise(i=>setTimeout(i,100))}return!1}async function _(){if(typeof document>"u")return;const e=document.getElementById("loading");e.style.display="block";try{if(console.log("Waiting for Supabase..."),!await h()){l("Supabase 未加载，请刷新页面重试");return}console.log("Supabase loaded, fetching articles...");let a=window.__supabase.from("articles").select("id, title, summary, content, cover_url, tags, visibility, status, created_at, likes_count, comments_count").order("created_at",{ascending:!1});const{data:t,error:r}=await a;if(r){console.error("Database error:",r),l("数据库错误: "+r.message);return}console.log("Articles loaded:",t),v(t)}catch(s){console.error("Unexpected error:",s),l("加载失败: "+s.message)}}typeof document<"u"&&setTimeout(()=>{_()},100);const B=JSON.parse('{"title":"文章列表","description":"","frontmatter":{"title":"文章列表","layout":"page"},"headers":[],"relativePath":"articles/index.md","filePath":"articles/index.md"}'),$={name:"articles/index.md"};function w(e,s,i,a,t,r){return d(),c("div",null,[...s[0]||(s[0]=[n("div",{id:"articles-page"},[n("div",{class:"page-header"},[n("h1",null,"📚 文章列表"),n("div",{class:"filter-bar"},[n("button",{id:"filter-all",class:"filter-btn active",onclick:"if(typeof document !== 'undefined') filterArticles('all')"},"全部"),n("button",{id:"filter-published",class:"filter-btn",onclick:"if(typeof document !== 'undefined') filterArticles('published')"},"已发布"),n("button",{id:"filter-pending",class:"filter-btn",onclick:"if(typeof document !== 'undefined') filterArticles('pending')"},"待审核"),n("button",{id:"filter-draft",class:"filter-btn",onclick:"if(typeof document !== 'undefined') filterArticles('draft')"},"草稿")])]),n("div",{id:"loading",class:"loading"},[n("p",null,"加载中..."),n("p",{class:"loading-hint"},"如果长时间没有响应，请检查浏览器控制台")]),n("div",{id:"error",class:"error",style:{display:"none"}},[n("p",{id:"error-message"},"加载失败，请刷新页面重试")]),n("div",{id:"no-articles",class:"no-articles",style:{display:"none"}},[n("p",null,"暂无文章"),n("p",null,[n("a",{href:"/SiteProject/editor",class:"link"},"去发布第一篇文章")])]),n("div",{id:"articles-list",class:"articles-list",style:{display:"none"}})],-1)])])}const S=o($,[["render",w]]);export{B as __pageData,S as default};
