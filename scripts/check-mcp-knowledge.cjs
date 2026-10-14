const {chromium}=require('playwright')
const assert=require('node:assert/strict')
const base=process.env.RD_UI_TEST_URL||'http://127.0.0.1:5191'
assert.equal(new URL(base).hostname,'127.0.0.1')
async function main(){
  const browser=await chromium.launch({channel:'msedge',headless:true,args:['--disable-gpu']})
  try{
    const page=await browser.newPage({viewport:{width:1440,height:1000}})
    const errors=[];page.on('pageerror',e=>errors.push(e.message))
    await page.goto(base+'/api/__preview/admin')
    await page.goto(base+'/mcp/')
    const checkbox=page.getByRole('checkbox',{name:'知识库节点写入'})
    await checkbox.check()
    const issued=page.waitForResponse(r=>r.url().endsWith('/api/mcp-tokens')&&r.request().method()==='POST')
    await page.getByRole('button',{name:'创建令牌',exact:true}).click()
    const grant=await (await issued).json()
    assert.equal(grant.allow_knowledge_write,true)
    const call=async(name,data)=>{
      const r=await page.request.post(base+'/api/note-upload/'+name,{headers:{Authorization:'Bearer '+grant.token},data})
      assert.ok(r.ok(),await r.text());return r.json()
    }
    const node=await call('create_knowledge_node',{request_key:'ui-node',name:'MCP 浏览器测试',description:'AI 帮助撰写知识库笔记',parent_id:null})
    assert.equal(node.creator.username,'预览管理员')
    const draft=await call('save_article_draft',{import_key:'ui-linked-note',title:'MCP 草稿测试',markdown:'# 标题\n\n$E=mc^2$\n\n```js\nconsole.log(1)\n```',knowledge_branch_id:node.id})
    await page.goto(base+'/kb/?branch='+node.id)
    await page.locator('.knowledge-creator').filter({hasText:'预览管理员'}).waitFor()
    await page.screenshot({path:'artifacts/mcp-knowledge-desktop.png',fullPage:true})
    await page.setViewportSize({width:390,height:844})
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1))
    await page.screenshot({path:'artifacts/mcp-knowledge-mobile.png',fullPage:true})
    assert.deepEqual(errors,[])
    const revoke=await page.request.delete(base+'/api/mcp-tokens/'+grant.id,{headers:{'X-RD-CSRF':'1'}})
    assert.ok(revoke.ok())
    console.log(JSON.stringify({creator:node.creator.username,node:node.id,draft:draft.id,checks:'token UI, node creation, Markdown draft, creator desktop/mobile, no page errors'}))
  }finally{await browser.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1})
