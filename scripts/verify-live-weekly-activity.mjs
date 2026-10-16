import assert from 'node:assert/strict'
const base='http://127.0.0.1:3100/api'
const response=await fetch(base+'/activity/weekly?limit=5')
assert.ok(response.ok)
const data=await response.json()
assert.equal(new Date(data.start_at+28800000).getUTCDay(),1)
assert.equal(data.end_at-data.start_at,7*86400000)
assert.equal(data.own,null)
assert.equal(data.next_week,null)
for(const [index,row] of data.items.entries()){
  assert.ok(row.weekly_exp>0&&row.rank>0)
  if(index)assert.ok(data.items[index-1].weekly_exp>=row.weekly_exp)
  assert.deepEqual(Object.keys(row).sort(),['avatar_url','id','rank','username','weekly_exp'])
}
if(data.previous_week){const previous=await (await fetch(base+'/activity/weekly?week='+data.previous_week)).json();assert.equal(previous.next_week,data.week_start)}
assert.equal((await fetch(base+'/community/daily')).status,401)
console.log(JSON.stringify({week_start:data.week_start,week_end:data.week_end,active_members:data.total,public_api:'ok',visitor_checkin:'login required',verification:'read only; no EXP awarded'}))
