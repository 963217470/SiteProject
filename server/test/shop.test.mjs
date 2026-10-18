import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID, createHmac } from 'node:crypto'
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { openDatabase } from '../database.mjs'
import { createApp } from '../app.mjs'
import { shopRules } from '../shop.mjs'

async function fixture(t, options = {redemptionsEnabled:true}) {
  const db=openDatabase(':memory:'), dataDir=mkdtempSync(join(tmpdir(),'rd-shop-')),secret='shop-test-secret-not-a-production-credential',cookies={}
  let time=Date.UTC(2026,9,18,4)
  for(const id of ['admin','author','other',...Array.from({length:shopRules.article_likes+1},(_,i)=>'l'+(i+1))]){
    db.prepare('INSERT INTO users(id,github_id,github_username) VALUES(?,?,?)').run(id,id,id)
    db.prepare('INSERT INTO profiles(id,username,role) VALUES(?,?,?)').run(id,id,id==='admin'?'admin':'member')
    const sid=randomUUID(),expires=Date.now()+86400000
    db.prepare('INSERT INTO sessions(sid,data,expires) VALUES(?,?,?)').run(sid,JSON.stringify({passport:{user:id},cookie:{originalMaxAge:86400000,expires:new Date(expires),httpOnly:true,path:'/'}}),expires)
    cookies[id]='rd.sid='+encodeURIComponent('s:'+sid+'.'+createHmac('sha256',secret).update(sid).digest('base64').replace(/=+$/,''))
  }
  const server=createApp(db,{dataDir,now:()=>time,sessionSecret:secret,production:false,siteUrl:'http://localhost',maxUploadMb:1,adminGithubIds:[],shopRedemptionsEnabled:options.redemptionsEnabled}).listen(0,'127.0.0.1')
  await new Promise(resolve=>server.once('listening',resolve))
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));db.close();rmSync(dataDir,{recursive:true,force:true})})
  async function call(path,role='author',method='GET',body,extra={}){
    const response=await fetch('http://127.0.0.1:'+server.address().port+'/api'+path,{method,headers:{'X-RD-CSRF':'1',...(role?{Cookie:cookies[role]}:{}),...(body?{'Content-Type':'application/json'}:{}),...extra},body:body?JSON.stringify(body):undefined})
    return {status:response.status,data:await response.json()}
  }
  const product=async extra=>{
    const body={title:'社团贴纸',description:'Test item',category:'周边',cover_url:'/images/rd-studio-logo.png',price:5,stock:2,status:'published',...extra}
    const result=await call('/shop/admin/products','admin','POST',body);assert.equal(result.status,201);return result.data
  }
  const credit=(id,amount)=>db.prepare('INSERT INTO currency_ledger VALUES(?,?,?,?,?,?,?)').run(randomUUID(),id,amount,'article','test:'+randomUUID(),'Test credit',time)
  const redeem=(product,extra={})=>call('/shop/orders','author','POST',{product_id:product.id,expected_revision:product.revision,request_key:randomUUID(),...extra})
  return {db,call,product,credit,redeem,advance:days=>{time+=days*86400000}}
}

test('shop is public but wallets and administration require the right identity',async t=>{
  const f=await fixture(t),published=await f.product(),draft=await f.product({status:'draft'})
  assert.deepEqual((await f.call('/shop/products',null)).data.items.map(item=>item.id),[published.id])
  assert.equal((await f.call('/shop/me',null)).status,401)
  assert.equal((await f.call('/shop/admin/products')).status,403)
  assert.equal((await f.call('/shop/admin/products','author','POST',{})).status,403)
  assert.equal((await f.call('/shop/admin/products','admin')).data.items.length,2)
  assert.equal((await f.call('/data/currency_ledger','admin')).status,404)
  assert.equal((await f.call('/shop/orders','author','POST',{product_id:draft.id,request_key:'private',expected_revision:1})).status,404)
})

test('display-only mode rejects direct redemption requests without orders, deductions or inventory changes',async t=>{
  const f=await fixture(t,{}),product=await f.product();f.credit('author',20)
  const rules=(await f.call('/shop/products',null)).data.rules
  assert.equal(rules.article_likes,10);assert.equal(rules.redemptions_enabled,false)
  assert.equal((await f.redeem(product)).status,409)
  assert.equal((await f.call('/shop/me')).data.balance,20)
  assert.equal((await f.call('/shop/products')).data.items[0].stock,2)
  assert.equal(f.db.prepare('SELECT count(*) n FROM shop_orders').get().n,0)
  assert.equal(f.db.prepare("SELECT count(*) n FROM currency_ledger WHERE kind='redeem'").get().n,0)
})

test('article coins use real other-user likes, not counters or self likes; rewards survive unlike and cannot repeat',async t=>{
  const f=await fixture(t),id=randomUUID()
  f.db.prepare("INSERT INTO articles(id,title,content,author_id,status) VALUES(?,?,?,'author','published')").run(id,'Article','Body')
  f.db.prepare('UPDATE articles SET likes_count=999 WHERE id=?').run(id)
  await f.call('/data/article_likes','author','POST',{article_id:id})
  for(let n=1;n<shopRules.article_likes;n++)await f.call('/data/article_likes','l'+n,'POST',{article_id:id})
  assert.equal((await f.call('/shop/me')).data.balance,0)
  assert.equal((await f.call('/data/article_likes','l'+shopRules.article_likes,'POST',{article_id:id})).status,200)
  assert.equal((await f.call('/shop/me')).data.balance,shopRules.article_reward)
  await f.call('/data/article_likes?article_id=eq.'+id,'l1','DELETE',{})
  await f.call('/data/article_likes','l1','POST',{article_id:id})
  assert.equal((await f.call('/shop/me')).data.balance,shopRules.article_reward)
  assert.equal((await f.call('/shop/me','other')).data.balance,0)
  assert.equal(f.db.prepare("SELECT count(*) n FROM currency_ledger WHERE kind='article'").get().n,1)
})

test('unpublished and internal notes do not earn article currency; publication unlocks one reward',async t=>{
  const f=await fixture(t)
  for(const visibility of ['public','internal']){
    const id=randomUUID()
    f.db.prepare("INSERT INTO articles(id,title,content,author_id,status,visibility) VALUES(?,?,?,'author','draft',?)").run(id,'Draft','Body',visibility)
    for(let n=1;n<=shopRules.article_likes;n++)f.db.prepare('INSERT INTO article_likes VALUES(?,?,?)').run(id,'l'+n,new Date().toISOString())
    await f.call('/shop/me');assert.equal((await f.call('/shop/me')).data.balance,visibility==='public'?0:shopRules.article_reward)
    f.db.prepare("UPDATE articles SET status='published' WHERE id=?").run(id)
    await f.call('/shop/me')
  }
  assert.equal((await f.call('/shop/me')).data.balance,shopRules.article_reward)
})

test('only day eight onward earns one coin, once per Beijing day, and a gap restarts the streak',async t=>{
  const f=await fixture(t)
  for(let day=1;day<=9;day++){
    const result=await f.call('/community/checkin','author','POST',{})
    assert.equal(result.data.currency_reward,day>7?1:0)
    assert.equal((await f.call('/community/checkin','author','POST',{})).data.currency_reward,0)
    assert.equal((await f.call('/shop/me')).data.balance,Math.max(0,day-7))
    f.advance(1)
  }
  f.advance(1)
  assert.equal((await f.call('/community/checkin','author','POST',{})).data.streak,1)
  assert.equal((await f.call('/shop/me')).data.balance,2)
  assert.throws(()=>f.db.exec('DELETE FROM currency_ledger'),/immutable/)
})

test('orders debit once, never overspend or oversell, and preserve their product snapshot',async t=>{
  const f=await fixture(t),product=await f.product({stock:1})
  await f.call('/community/checkin','author','POST',{})
  const xpBefore=(await f.call('/tasks/me')).data.xp
  assert.equal((await f.redeem(product)).status,409)
  f.credit('author',10)
  const key=randomUUID(),request={product_id:product.id,expected_revision:1,request_key:key,note:'领取'}
  const results=await Promise.all([f.call('/shop/orders','author','POST',request),f.call('/shop/orders','author','POST',request)])
  assert(results.every(result=>result.status===201))
  assert.equal(results[0].data.order.id,results[1].data.order.id)
  assert.equal((await f.call('/shop/me')).data.balance,5)
  assert.equal((await f.call('/tasks/me')).data.xp,xpBefore)
  assert.equal((await f.redeem(product)).status,409)
  assert.equal((await f.call('/shop/orders','other')).data.items.length,0)
  assert.equal((await f.call('/shop/admin/products/'+product.id,'admin','PUT',{title:'New',description:'',category:'周边',cover_url:'',price:99,stock:0,status:'archived',expected_revision:2})).status,200)
  assert.equal((await f.call('/shop/orders')).data.items[0].product_title,'社团贴纸')
  assert.equal((await f.call('/shop/orders')).data.items[0].price,5)
})

test('concurrent distinct requests cannot overdraw a wallet even with unlimited stock',async t=>{
  const f=await fixture(t),product=await f.product({stock:null});f.credit('author',5)
  const results=await Promise.all([f.redeem(product),f.redeem(product)])
  assert.deepEqual(results.map(row=>row.status).sort(),[201,409])
  assert.equal((await f.call('/shop/me')).data.balance,0)
  assert.throws(()=>f.db.prepare('INSERT INTO currency_ledger VALUES(?,?,?,?,?,?,?)').run(randomUUID(),'author',-1,'redeem','evil','Invalid debit',Date.now()),/Insufficient/)
})

test('cancellation refunds and restores inventory once; fulfillment and recipient messages are scoped',async t=>{
  const f=await fixture(t),product=await f.product();f.credit('author',10)
  const order=(await f.redeem(product)).data.order
  assert.equal((await f.call('/shop/admin/orders/'+order.id,'author','POST',{status:'cancelled',fulfillment_note:'cancel'})).status,403)
  for(let i=0;i<2;i++)assert.equal((await f.call('/shop/admin/orders/'+order.id,'admin','POST',{status:'cancelled',fulfillment_note:'暂时缺货'})).status,200)
  assert.equal((await f.call('/shop/me')).data.balance,10)
  assert.equal((await f.call('/shop/products')).data.items[0].stock,2)
  assert.equal(f.db.prepare("SELECT count(*) n FROM currency_ledger WHERE kind='refund'").get().n,1)
  const current=(await f.call('/shop/products')).data.items[0]
  const second=(await f.redeem(current)).data.order
  assert.equal((await f.call('/shop/admin/orders/'+second.id,'admin','POST',{status:'fulfilled',fulfillment_note:'已线下领取'})).status,200)
  assert.equal((await f.call('/shop/admin/orders/'+second.id,'admin','POST',{status:'cancelled',fulfillment_note:'again'})).status,409)
  assert.equal((await f.call('/shop/me')).data.balance,5)
  assert.equal((await f.call('/shop/orders')).data.items.find(item=>item.id===second.id).fulfillment_note,'已线下领取')
  assert(f.db.prepare("SELECT count(*) n FROM notifications WHERE user_id='admin' AND event_key LIKE 'shop-order:%'").get().n>=2)
  assert.equal(f.db.prepare("SELECT count(*) n FROM notifications WHERE user_id='other' AND event_key LIKE 'shop-%'").get().n,0)
})

test('product edits reject stale revisions and unsafe images; clients cannot set price or the currency amount',async t=>{
  const f=await fixture(t),product=await f.product()
  const base={title:'Safe',description:'',category:'Other',cover_url:'',price:5,stock:2,status:'published'}
  for(const cover_url of ['javascript:alert(1)','data:text/html,test','//evil.example/x','/images/../secret','/api/private'])assert.equal((await f.call('/shop/admin/products','admin','POST',{...base,cover_url})).status,400)
  assert.equal((await f.call('/shop/admin/products/'+product.id,'admin','PUT',{...base,expected_revision:999})).status,409)
  f.credit('author',10)
  assert.equal((await f.call('/shop/orders','author','POST',{product_id:product.id,request_key:'forged',expected_revision:1,price:0})).status,400)
  assert.equal((await f.call('/shop/products?offset=-1')).status,400)
  assert.equal((await f.call('/shop/admin/products','admin','POST',base,{'X-RD-CSRF':'0'})).status,403)
})
