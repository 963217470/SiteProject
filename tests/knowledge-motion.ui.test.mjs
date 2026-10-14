import { afterEach, expect, it, vi } from 'vitest'
import cytoscape from 'cytoscape'
import { createKnowledgeMotion, nodePointerOffset } from '../docs/.vitepress/theme/lib/knowledge-motion.mjs'

let graph,motion
afterEach(()=>{motion?.destroy();graph?.destroy();vi.unstubAllGlobals()})
function setup({fine=true,reduced=false}={}) {
  const screens={fine:Object.assign(new EventTarget(),{matches:fine}),reduced:Object.assign(new EventTarget(),{matches:reduced})}
  vi.stubGlobal('matchMedia',query=>query.includes('reduced-motion')?screens.reduced:screens.fine)
  let sequence=0
  const frames=new Map()
  vi.stubGlobal('requestAnimationFrame',callback=>{frames.set(++sequence,callback);return sequence})
  vi.stubGlobal('cancelAnimationFrame',id=>frames.delete(id))
  graph=cytoscape({headless:true,elements:[{data:{id:'moving'},position:{x:50,y:50}},{data:{id:'pinned'},position:{x:90,y:50}},{data:{id:'root'},position:{x:20,y:20}}],layout:{name:'preset',fit:false},zoom:1,pan:{x:0,y:0}})
  const stage=document.createElement('div')
  stage.getBoundingClientRect=()=>({left:0,top:0})
  motion=createKnowledgeMotion(graph,stage,id=>id==='pinned')
  const tick=()=>{for(let i=0;i<80&&frames.size;i++){const [id,callback]=frames.entries().next().value;frames.delete(id);callback()}}
  return {stage,screens,tick,frames}
}
it('bounds pointer displacement and ignores distant points',()=>{
  expect(nodePointerOffset({x:50,y:50},{x:45,y:50}).x).toBeGreaterThan(0)
  expect(Math.hypot(...Object.values(nodePointerOffset({x:50,y:50},{x:45,y:50})))).toBeLessThanOrEqual(5)
  expect(nodePointerOffset({x:500,y:500},{x:0,y:0})).toEqual({x:0,y:0})
})
it('moves only nearby unfixed nodes, returns to the same base, and stops rendering when settled',()=>{
  const f=setup()
  f.stage.dispatchEvent(new MouseEvent('pointermove',{clientX:45,clientY:50}));f.tick()
  expect(graph.getElementById('moving').position('x')).toBeGreaterThan(50)
  expect(graph.getElementById('moving').position('x')).toBeLessThanOrEqual(55)
  expect(graph.getElementById('pinned').position()).toEqual({x:90,y:50})
  expect(graph.getElementById('root').position()).toEqual({x:20,y:20})
  expect(f.frames.size).toBe(0)
  f.stage.dispatchEvent(new Event('pointerleave'));f.tick()
  expect(graph.getElementById('moving').position()).toEqual({x:50,y:50})
})
it('preserves a manually dragged base instead of baking the hover offset into it',()=>{
  const f=setup()
  f.stage.dispatchEvent(new MouseEvent('pointermove',{clientX:45,clientY:50}));f.tick()
  f.stage.dispatchEvent(new Event('pointerdown'))
  expect(graph.getElementById('moving').position()).toEqual({x:50,y:50})
  graph.getElementById('moving').position({x:130,y:160})
  graph.getElementById('moving').emit('dragfree')
  f.stage.dispatchEvent(new MouseEvent('pointermove',{clientX:125,clientY:160}));f.tick()
  motion.reset()
  expect(graph.getElementById('moving').position()).toEqual({x:130,y:160})
})
it('disables movement for coarse pointers and reduced motion, including live preference changes',()=>{
  const f=setup({fine:false})
  f.stage.dispatchEvent(new MouseEvent('pointermove',{clientX:45,clientY:50}));f.tick()
  expect(graph.getElementById('moving').position()).toEqual({x:50,y:50})
  f.screens.fine.matches=true
  f.stage.dispatchEvent(new MouseEvent('pointermove',{clientX:45,clientY:50}));f.tick()
  expect(graph.getElementById('moving').position('x')).toBeGreaterThan(50)
  f.screens.reduced.matches=true;f.screens.reduced.dispatchEvent(new Event('change'))
  f.stage.dispatchEvent(new MouseEvent('pointermove',{clientX:45,clientY:50}));f.tick()
  expect(graph.getElementById('moving').position()).toEqual({x:50,y:50})
  expect(f.frames.size).toBe(0)
})
