import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'

const [livePath,beforePath]=process.argv.slice(2)
assert(livePath && beforePath,'Usage: verify-catalog-links-migration.mjs LIVE_DATABASE BEFORE_DATABASE')
const live=new DatabaseSync(livePath,{readOnly:true}),before=new DatabaseSync(beforePath,{readOnly:true})
try{
  assert.equal(live.prepare('PRAGMA user_version').get().user_version,15)
  assert.equal(before.prepare('PRAGMA user_version').get().user_version,14)
  assert.equal(live.prepare('PRAGMA integrity_check').get().integrity_check,'ok')
  assert.deepEqual(live.prepare('PRAGMA foreign_key_check').all(),[])
  const retained={}
  for(const table of ['users','profiles','articles','files','tasks','knowledge_branches','currency_ledger','shop_products','shop_orders','catalog_items']){
    const old=before.prepare('SELECT id FROM "'+table+'"').all(),ids=new Set(live.prepare('SELECT id FROM "'+table+'"').all().map(row=>row.id))
    assert(old.every(row=>ids.has(row.id)),table+' lost a record');retained[table]=old.length
  }
  for(const old of before.prepare('SELECT * FROM catalog_items').all()){
    const {download_links,...unchanged}=live.prepare('SELECT * FROM catalog_items WHERE id=?').get(old.id)
    assert.deepEqual(unchanged,{...old})
    assert.deepEqual(JSON.parse(download_links),old.external_url ? [{id:'legacy',label:'外部下载',url:old.external_url,extraction_code:old.extraction_code}] : [])
  }
  console.log(JSON.stringify({schema:15,integrity:'ok',retained,legacyLinksPreserved:true}))
}finally{live.close();before.close()}
