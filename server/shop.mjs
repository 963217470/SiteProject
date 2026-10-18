import { randomUUID } from 'node:crypto'
import { fail } from './repository.mjs'
import { adminAudit } from './admin-audit.mjs'

export const shopRules = Object.freeze({ name: '创作币', article_likes: 10, article_reward: 0, streak_start: 8, streak_reward: 0, earning_enabled: false, test: true, redemptions_enabled: false })
export const currencyBalance = (db, user) => db.prepare('SELECT coalesce(sum(amount),0) amount FROM currency_ledger WHERE user_id=?').get(user).amount
function ledger(db, user, amount, kind, key, reason, time) {
  return db.prepare('INSERT OR IGNORE INTO currency_ledger VALUES(?,?,?,?,?,?,?)').run(randomUUID(), user, amount, kind, key, reason, time).changes
}
export function flushCurrency(db, now = Date.now) {
  if (!shopRules.earning_enabled) return
  for (const event of db.prepare('SELECT article_id FROM currency_article_events').all()) {
    const article = db.prepare("SELECT id,title,author_id FROM articles WHERE id=? AND status='published' AND visibility='public'").get(event.article_id)
    if (article && db.prepare('SELECT count(*) n FROM article_likes WHERE article_id=? AND user_id<>?').get(article.id, article.author_id).n >= shopRules.article_likes) {
      ledger(db, article.author_id, shopRules.article_reward, 'article', 'article:' + article.id, '文章获赞奖励：' + article.title, now())
    }
    db.prepare('DELETE FROM currency_article_events WHERE article_id=?').run(event.article_id)
  }
}
const text = (value, limit, required = false) => {
  if (typeof value !== 'string' || value.length > limit || required && !value.trim()) fail(400, '内容格式或长度无效')
  return value.trim()
}
const integer = (value, min, max) => { if (!Number.isSafeInteger(value) || value < min || value > max) fail(400, '数值超出范围'); return value }
function page(query) { return integer(Number(query.offset || 0), 0, 100000) }
function productInput(body) {
  if (!body || Object.keys(body).some(key => !['title','description','category','cover_url','price','stock','status','expected_revision'].includes(key))) fail(400, '商品字段无效')
  const cover = text(body.cover_url || '', 2000)
  if (cover) {
    let url; try { url = new URL(cover, 'https://local.invalid') } catch { fail(400, '商品图片网址无效') }
    const internal=cover.startsWith('/images/') && url.origin==='https://local.invalid' && url.pathname.startsWith('/images/') && !cover.includes('\\')
    const external=/^https:\/\//i.test(cover) && url.protocol==='https:' && !url.username && !url.password
    if (!internal && !external) fail(400, '请使用 HTTPS 图片网址或站内图片')
  }
  if (!['draft','published','archived'].includes(body.status)) fail(400, '商品状态无效')
  return { title:text(body.title,100,true),description:text(body.description || '',4000),category:text(body.category || '其他',30,true),cover_url:cover,price:integer(body.price,1,1000000),stock:body.stock === null ? null : integer(body.stock,0,1000000),status:body.status }
}
export function installShopRoutes(app, db, repository, now = Date.now, redemptionsEnabled = false) {
  const rules={...shopRules,redemptions_enabled:redemptionsEnabled}
  const auth = (req, _res, next) => req.user ? next() : next(Object.assign(new Error('请先登录'), { status:401 }))
  const admin = (req, _res, next) => req.user?.role === 'admin' ? next() : next(Object.assign(new Error('需要管理员权限'), { status:req.user ? 403 : 401 }))
  const ownOrders = (user, offset) => db.prepare('SELECT * FROM shop_orders WHERE user_id=? ORDER BY created_at DESC,id LIMIT 21 OFFSET ?').all(user, offset)
  app.get('/api/shop/products', (req,res) => {
    const q=text(req.query.q || '',80), category=text(req.query.category || '',30), offset=page(req.query)
    const where="status='published' AND (?='' OR instr(lower(title),lower(?))>0) AND (?='' OR category=?)", args=[q,q,category,category]
    const rows=db.prepare('SELECT * FROM shop_products WHERE '+where+' ORDER BY created_at DESC,id LIMIT 21 OFFSET ?').all(...args,offset)
    res.json({items:rows.slice(0,20),has_more:rows.length>20,total:db.prepare('SELECT count(*) n FROM shop_products WHERE '+where).get(...args).n,categories:db.prepare("SELECT DISTINCT category FROM shop_products WHERE status='published' ORDER BY category").all().map(row=>row.category),rules})
  })
  app.get('/api/shop/me', auth, (req,res) => res.json({balance:currencyBalance(db,req.user.id),role:req.user.role,rules}))
  app.get('/api/shop/ledger', auth, (req,res) => {
    const rows=db.prepare('SELECT id,amount,kind,reason,created_at FROM currency_ledger WHERE user_id=? ORDER BY created_at DESC,rowid DESC LIMIT 21 OFFSET ?').all(req.user.id,page(req.query))
    res.json({items:rows.slice(0,20),has_more:rows.length>20,balance:currencyBalance(db,req.user.id)})
  })
  app.get('/api/shop/orders', auth, (req,res) => { const rows=ownOrders(req.user.id,page(req.query));res.json({items:rows.slice(0,20),has_more:rows.length>20}) })
  app.post('/api/shop/orders', auth, (req,res) => {
    if(!redemptionsEnabled)fail(409,'商城测试阶段暂不开放兑换，不会扣除创作币')
    const body=req.body || {}, productId=text(body.product_id,100,true), key=text(body.request_key,100,true), note=text(body.note || '',500)
    if (Object.keys(body).some(key=>!['product_id','request_key','note','expected_revision'].includes(key))) fail(400,'兑换字段无效')
    const order=repository.transaction(()=>{
      const previous=db.prepare('SELECT * FROM shop_orders WHERE user_id=? AND request_key=?').get(req.user.id,key)
      if(previous){if(previous.product_id!==productId || previous.note!==note)fail(409,'此请求标识已用于其他兑换');return previous}
      const product=db.prepare("SELECT * FROM shop_products WHERE id=? AND status='published'").get(productId)
      if(!product)fail(404,'商品不存在或已下架')
      if(product.revision!==body.expected_revision)fail(409,'商品信息已更新，请刷新后重新确认')
      if(product.stock===0)fail(409,'商品已兑完')
      if(currencyBalance(db,req.user.id)<product.price)fail(409,'创作币不足')
      const id=randomUUID(),time=now()
      db.prepare("INSERT INTO shop_orders(id,user_id,product_id,product_title,product_revision,price,request_key,note,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)").run(id,req.user.id,product.id,product.title,product.revision,product.price,key,note,time,time)
      if(product.stock!==null)db.prepare('UPDATE shop_products SET stock=stock-1,revision=revision+1,updated_at=? WHERE id=?').run(time,product.id)
      ledger(db,req.user.id,-product.price,'redeem','order:'+id,'兑换：'+product.title,time)
      for(const person of db.prepare("SELECT id FROM profiles WHERE role='admin'").all())db.prepare("INSERT OR IGNORE INTO notifications(id,user_id,event_key,title,body,href,created_at,category) VALUES(?,?,?,?,?,?,?,'review')").run(randomUUID(),person.id,'shop-order:'+id,'新的商城兑换待处理',product.title,'/admin/shop/?view=orders',time)
      return db.prepare('SELECT * FROM shop_orders WHERE id=?').get(id)
    })
    res.status(201).json({order,balance:currencyBalance(db,req.user.id)})
  })
  app.get('/api/shop/admin/products', admin, (req,res) => {
    const rows=db.prepare('SELECT * FROM shop_products ORDER BY updated_at DESC,id LIMIT 21 OFFSET ?').all(page(req.query))
    res.json({items:rows.slice(0,20),has_more:rows.length>20})
  })
  app.post('/api/shop/admin/products', admin, (req,res) => {
    const input=productInput(req.body),id=randomUUID(),time=now()
    repository.transaction(()=>{db.prepare('INSERT INTO shop_products(id,title,description,category,cover_url,price,stock,status,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,...Object.values(input),req.user.id,time,time);adminAudit(db,req.user,'创建商品','shop-product',id,input.title,time)})
    res.status(201).json(db.prepare('SELECT * FROM shop_products WHERE id=?').get(id))
  })
  app.put('/api/shop/admin/products/:id', admin, (req,res) => {
    const input=productInput(req.body)
    repository.transaction(()=>{
      const previous=db.prepare('SELECT * FROM shop_products WHERE id=?').get(req.params.id)
      if(!previous)fail(404,'商品不存在')
      if(req.body.expected_revision!==previous.revision)fail(409,'商品已被修改，请刷新后重试')
      db.prepare('UPDATE shop_products SET title=?,description=?,category=?,cover_url=?,price=?,stock=?,status=?,revision=revision+1,updated_at=? WHERE id=?').run(...Object.values(input),now(),previous.id)
      adminAudit(db,req.user,'更新商品','shop-product',previous.id,input.title,now())
    })
    res.json(db.prepare('SELECT * FROM shop_products WHERE id=?').get(req.params.id))
  })
  app.get('/api/shop/admin/orders', admin, (req,res) => {
    const status=req.query.status || ''
    if(status && !['pending','fulfilled','cancelled'].includes(status))fail(400,'订单状态无效')
    const rows=db.prepare("SELECT o.*,p.username FROM shop_orders o JOIN profiles p ON p.id=o.user_id WHERE (?='' OR o.status=?) ORDER BY o.created_at DESC,o.id LIMIT 21 OFFSET ?").all(status,status,page(req.query))
    res.json({items:rows.slice(0,20),has_more:rows.length>20})
  })
  app.post('/api/shop/admin/orders/:id', admin, (req,res) => {
    const status=req.body?.status,note=text(req.body?.fulfillment_note || '',1000,true)
    if(!['fulfilled','cancelled'].includes(status))fail(400,'处理结果无效')
    repository.transaction(()=>{
      const order=db.prepare('SELECT * FROM shop_orders WHERE id=?').get(req.params.id)
      if(!order)fail(404,'订单不存在')
      if(order.status!=='pending'){
        if(order.status===status && order.fulfillment_note===note)return
        fail(409,'订单已处理，请刷新后重试')
      }
      if(status==='cancelled'){
        ledger(db,order.user_id,order.price,'refund','refund:'+order.id,'取消兑换退回：'+order.product_title,now())
        db.prepare('UPDATE shop_products SET stock=min(stock+1,1000000),revision=revision+1,updated_at=? WHERE id=? AND stock IS NOT NULL').run(now(),order.product_id)
      }
      db.prepare('UPDATE shop_orders SET status=?,fulfillment_note=?,updated_at=? WHERE id=?').run(status,note,now(),order.id)
      adminAudit(db,req.user,status==='fulfilled'?'完成兑换':'取消并退币','shop-order',order.id,note,now())
      db.prepare("INSERT OR IGNORE INTO notifications(id,user_id,event_key,title,body,href,created_at,category) VALUES(?,?,?,?,?,?,?,'result')").run(randomUUID(),order.user_id,'shop-result:'+order.id,status==='fulfilled'?'商城兑换已完成':'商城兑换已取消并退币',note,'/shop/?view=orders',now())
    })
    res.json({ok:true})
  })
}
