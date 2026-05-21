import{c as o,S as c,j as d,g as s}from"./chunks/framework.DOPCDQAF.js";var u="all";function p(e){return new Date(e).toLocaleDateString("zh-CN",{year:"numeric",month:"long",day:"numeric"})}function g(e){return{public:"🌐 公开",internal:"🔒 内部"}[e]||e}function m(e){return{draft:"📝 草稿",pending:"⏳ 待审核",published:"✅ 已发布",rejected:"❌ 已拒绝"}[e]||e}function f(e){return{draft:"badge-draft",pending:"badge-pending",published:"badge-published",rejected:"badge-rejected"}[e]||"badge-draft"}function y(e){return e?e.substring(0,200)+(e.length>200?"...":""):""}function r(e){const a=document.getElementById("loading"),n=document.getElementById("error"),i=document.getElementById("error-message");a.style.display="none",n.style.display="block",i.textContent=e,console.error("Articles page error:",e)}function b(){const e=document.getElementById("loading"),a=document.getElementById("no-articles");e.style.display="none",a.style.display="block"}function v(e){const a=document.getElementById("loading"),n=document.getElementById("no-articles"),i=document.getElementById("articles-list");if(a.style.display="none",n.style.display="none",i.style.display="block",!e||e.length===0){b();return}i.innerHTML=e.map(t=>`
    <div class="article-card">
      ${t.cover_url?`<img src="${t.cover_url}" class="article-cover" alt="${t.title}" onerror="this.style.display='none'">`:""}
      <div class="article-content">
        <div class="article-header">
          <h2><a href="/SiteProject/article?id=${t.id}">${t.title}</a></h2>
          <span class="badge ${f(t.status)}">${m(t.status)}</span>
        </div>
        <p class="article-summary">${t.summary||y(t.content)}</p>
        <div class="article-meta">
          <span class="meta-item">📅 ${p(t.created_at)}</span>
          <span class="meta-item">${g(t.visibility)}</span>
          <span class="meta-item">❤️ ${t.likes_count||0}</span>
          <span class="meta-item">💬 ${t.comments_count||0}</span>
        </div>
        ${t.tags&&t.tags.length>0?`
          <div class="article-tags">
            ${t.tags.map(l=>`<span class="tag">#${l}</span>`).join("")}
          </div>
        `:""}
      </div>
    </div>
  `).join("")}async function h(e=30){for(let a=0;a<e;a++){if(window.__supabase)return!0;await new Promise(n=>setTimeout(n,100))}return!1}async function _(){const e=document.getElementById("loading");e.style.display="block";try{if(console.log("Waiting for Supabase..."),!await h()){r("Supabase 未加载，请刷新页面重试");return}console.log("Supabase loaded, fetching articles...");let i=window.__supabase.from("articles").select("id, title, summary, content, cover_url, tags, visibility, status, created_at, likes_count, comments_count").order("created_at",{ascending:!1});const{data:t,error:l}=await i;if(l){console.error("Database error:",l),r("数据库错误: "+l.message);return}console.log("Articles loaded:",t),v(t)}catch(a){console.error("Unexpected error:",a),r("加载失败: "+a.message)}}setTimeout(()=>{_()},100);const B=JSON.parse('{"title":"文章列表","description":"","frontmatter":{"title":"文章列表","layout":"page"},"headers":[],"relativePath":"articles/index.md","filePath":"articles/index.md"}'),$={name:"articles/index.md"};function w(e,a,n,i,t,l){return c(),d("div",null,[...a[0]||(a[0]=[s("div",{id:"articles-page"},[s("div",{class:"page-header"},[s("h1",null,"📚 文章列表"),s("div",{class:"filter-bar"},[s("button",{id:"filter-all",class:"filter-btn active",onclick:"filterArticles('all')"},"全部"),s("button",{id:"filter-published",class:"filter-btn",onclick:"filterArticles('published')"},"已发布"),s("button",{id:"filter-pending",class:"filter-btn",onclick:"filterArticles('pending')"},"待审核"),s("button",{id:"filter-draft",class:"filter-btn",onclick:"filterArticles('draft')"},"草稿")])]),s("div",{id:"loading",class:"loading"},[s("p",null,"加载中..."),s("p",{class:"loading-hint"},"如果长时间没有响应，请检查浏览器控制台")]),s("div",{id:"error",class:"error",style:{display:"none"}},[s("p",{id:"error-message"},"加载失败，请刷新页面重试")]),s("div",{id:"no-articles",class:"no-articles",style:{display:"none"}},[s("p",null,"暂无文章"),s("p",null,[s("a",{href:"/SiteProject/editor",class:"link"},"去发布第一篇文章")])]),s("div",{id:"articles-list",class:"articles-list",style:{display:"none"}})],-1)])])}const S=o($,[["render",w]]);export{B as __pageData,S as default};
