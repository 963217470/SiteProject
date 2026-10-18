import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'

const [livePath,beforePath]=process.argv.slice(2)
assert(livePath&&beforePath,'Usage: verify-shop-migration.mjs LIVE_DATABASE BEFORE_DATABASE')
const live=new DatabaseSync(livePath,{readOnly:true}),before=new DatabaseSync(beforePath,{readOnly:true})
try{
  assert.equal(live.prepare('PRAGMA user_version').get().user_version,14)
  assert.equal(before.prepare('PRAGMA user_version').get().user_version,13)
  assert.deepEqual(live.prepare('PRAGMA integrity_check').all().map(row=>row.integrity_check),['ok'])
  assert.equal(live.prepare('PRAGMA foreign_key_check').all().length,0)
  const retained={}
  for(const table of ['users','profiles','articles','files','tasks','experience_ledger','community_experience','knowledge_branches','knowledge_positions','currency_ledger','shop_products','shop_orders']){
    const column=table==='knowledge_positions'?'node_id':'id'
    const ids=new Set(live.prepare('SELECT "'+column+'" id FROM "'+table+'"').all().map(row=>row.id))
    const old=before.prepare('SELECT "'+column+'" id FROM "'+table+'"').all()
    assert(old.every(row=>ids.has(row.id)),table+' lost a pre-migration record')
    retained[table]=old.length
  }
  assert.equal(live.prepare('SELECT user_id,sum(amount) amount FROM currency_ledger GROUP BY user_id HAVING amount<0').all().length,0)
  assert.equal(live.prepare("SELECT count(*) n FROM sqlite_master WHERE type='trigger' AND name IN ('currency_checkin','currency_like_insert','currency_like_delete','currency_article_insert','currency_article_publish')").get().n,0)
  assert.equal(live.prepare('SELECT count(*) n FROM currency_article_events').get().n,0)
  console.log(JSON.stringify({schema:14,integrity:'ok',retained,products:live.prepare('SELECT count(*) n FROM shop_products').get().n,orders:live.prepare('SELECT count(*) n FROM shop_orders').get().n,coinEntries:live.prepare('SELECT count(*) n FROM currency_ledger').get().n}))
}finally{live.close();before.close()}
