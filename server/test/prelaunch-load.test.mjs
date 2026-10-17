import test from 'node:test'
import assert from 'node:assert/strict'
import { summarize } from '../../scripts/prelaunch-load.mjs'

test('load summaries calculate nearest-rank latency percentiles and include timeouts as failures',()=>{
  const rows=Array.from({length:100},(_,i)=>({status:200,ms:100-i,bytes:5}))
  const report=summarize(rows)
  assert.equal(report.p50,50);assert.equal(report.p95,95);assert.equal(report.p99,99);assert.equal(report.max,100);assert.equal(report.errors,0);assert.equal(report.bytes,500)
  assert.deepEqual(summarize([{status:'timeout',ms:3000,bytes:0},{status:429,ms:10,bytes:12}]).statuses,{timeout:1,429:1})
  assert.equal(summarize([{status:'timeout',ms:3000,bytes:0}]).errors,1)
  assert.equal(summarize([]).p95,0)
})
