import{c as u,S as p,j as m,m as y}from"./chunks/framework.DOPCDQAF.js";let g=null;function f(e){return new Date(e).toLocaleDateString("zh-CN",{year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"})}function _(e){return{public:"🌐 公开",internal:"🔒 内部"}[e]||e}function h(e){return{draft:"📝 草稿",pending:"⏳ 待审核",published:"✅ 已发布",rejected:"❌ 已拒绝"}[e]||e}function b(e){return e?"<p>"+e.replace(/^### (.*$)/gim,"<h3>$1</h3>").replace(/^## (.*$)/gim,"<h2>$1</h2>").replace(/^# (.*$)/gim,"<h1>$1</h1>").replace(/\*\*(.*?)\*\*/g,"<strong>$1</strong>").replace(/\*(.*?)\*/g,"<em>$1</em>").replace(/`([^`]+)`/g,"<code>$1</code>").replace(/\n\n/g,"</p><p>").replace(/\n/g,"<br>")+"</p>":""}async function v(e=30){for(let a=0;a<e;a++){if(window.__supabase)return console.log("Supabase loaded after",a*100,"ms"),!0;await new Promise(s=>setTimeout(s,100))}return!1}async function $(){const e=document.getElementById("loading"),a=document.getElementById("error"),s=document.getElementById("error-message"),n=document.getElementById("article-not-found"),i=document.getElementById("article-content");e.style.display="block",a.style.display="none",n.style.display="none",i.style.display="none";try{console.log("Starting loadArticle...");const l=new URLSearchParams(window.location.search).get("id");if(console.log("Article ID:",l),!l){e.style.display="none",n.style.display="block";return}if(console.log("Waiting for Supabase..."),!await v()){e.style.display="none",a.style.display="block",s.textContent="Supabase 未加载，请刷新页面重试";return}const c=window.__supabase;console.log("Fetching article...");const{data:t,error:o}=await c.from("articles").select("id, title, summary, content, cover_url, tags, visibility, status, created_at, likes_count, comments_count").eq("id",l).single();if(console.log("Query result:",{data:t,queryError:o}),o)throw new Error("查询失败: "+o.message);if(!t){e.style.display="none",n.style.display="block";return}e.style.display="none",g=t,document.title=t.title+" | 网站",i.style.display="block",i.innerHTML=`
      <div class="article-header">
        <a href="/SiteProject/articles" class="back-link">← 返回文章列表</a>
        ${t.cover_url?`<img src="${t.cover_url}" class="article-cover" alt="${t.title}" onerror="this.style.display='none'">`:""}
        <h1>${t.title}</h1>
        <div class="article-meta">
          <span class="meta-item">📅 ${f(t.created_at)}</span>
          <span class="meta-item">${_(t.visibility)}</span>
          <span class="meta-item">${h(t.status)}</span>
          <span class="meta-item">❤️ ${t.likes_count||0} 喜欢</span>
          <span class="meta-item">💬 ${t.comments_count||0} 评论</span>
        </div>
        ${t.tags&&t.tags.length>0?`
          <div class="article-tags">
            ${t.tags.map(d=>`<span class="tag">#${d}</span>`).join("")}
          </div>
        `:""}
      </div>

      ${t.summary?`<div class="article-summary">${t.summary}</div>`:""}

      <div class="article-body">
        ${b(t.content||"")}
      </div>

      <div class="article-footer">
        <button id="like-btn" class="like-btn">❤️ 喜欢这篇文章</button>
      </div>
    `,document.getElementById("like-btn").addEventListener("click",()=>k(t.id,t.likes_count))}catch(r){console.error("Load article error:",r),e.style.display="none",a.style.display="block",s.textContent="加载失败: "+r.message}}async function k(e,a){try{const s=window.__supabase;if(!s){alert("Supabase 未加载");return}const{data:{session:n}}=await s.auth.getSession();if(!n){alert("请先登录");return}const{error:i}=await s.from("article_likes").insert({article_id:e,user_id:n.user.id});if(i&&!i.message.includes("duplicate")){alert("点赞失败");return}i||await s.from("articles").update({likes_count:(a||0)+1}).eq("id",e),alert("点赞成功！"),window.location.reload()}catch(s){console.error("Like article error:",s)}}setTimeout(()=>{$()},100);const T=JSON.parse('{"title":"文章详情","description":"","frontmatter":{"title":"文章详情","layout":"page"},"headers":[],"relativePath":"article/index.md","filePath":"article/index.md"}'),w={name:"article/index.md"};function S(e,a,s,n,i,r){return p(),m("div",null,[...a[0]||(a[0]=[y("",1)])])}const B=u(w,[["render",S]]);export{T as __pageData,B as default};
