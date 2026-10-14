export function nodePointerOffset(position,pointer,radius=110,strength=5) {
  if(!pointer)return {x:0,y:0}
  const dx=position.x-pointer.x,dy=position.y-pointer.y,distance=Math.hypot(dx,dy)
  if(distance>=radius || distance<1)return {x:0,y:0}
  const amount=strength*(1-distance/radius)**2
  return {x:dx/distance*amount,y:dy/distance*amount}
}

export function createKnowledgeMotion(graph,container,isPinned) {
  const fine=window.matchMedia('(pointer: fine) and (hover: hover) and (min-width: 768px)')
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)')
  const records=new Map()
  let frame=0,pointer=null,interacting=false,destroyed=false
  const enabled=()=>fine.matches && !reduced.matches && !destroyed
  const remember=()=>graph.nodes().forEach(node=>records.set(node.id(),{node,base:{...node.position()},offset:{x:0,y:0}}))
  remember()
  function reset() {
    cancelAnimationFrame(frame);frame=0;pointer=null
    graph.batch(()=>{for(const record of records.values()){
      if(record.offset.x || record.offset.y)record.node.position(record.base)
      record.offset={x:0,y:0}
    }})
  }
  function update() {
    frame=0
    if(!enabled()||interacting){reset();return}
    const zoom=graph.zoom(),pan=graph.pan()
    let unsettled=false
    graph.batch(()=>{for(const [id,record] of records){
      const target=isPinned(id)||id==='root'?{x:0,y:0}:nodePointerOffset({x:record.base.x*zoom+pan.x,y:record.base.y*zoom+pan.y},pointer)
      const x=record.offset.x+(target.x-record.offset.x)*.18,y=record.offset.y+(target.y-record.offset.y)*.18
      const next={x:Math.abs(x-target.x)<.02?target.x:x,y:Math.abs(y-target.y)<.02?target.y:y}
      unsettled ||= next.x!==target.x || next.y!==target.y
      if(next.x!==record.offset.x || next.y!==record.offset.y)record.node.position({x:record.base.x+next.x/zoom,y:record.base.y+next.y/zoom})
      record.offset=next
    }})
    if(unsettled)frame=requestAnimationFrame(update)
  }
  function queue(){if(!frame&&enabled()&&!interacting)frame=requestAnimationFrame(update)}
  function move(event){
    if(!enabled()||interacting||(event.pointerType&&event.pointerType!=='mouse'))return
    const bounds=container.getBoundingClientRect()
    pointer={x:event.clientX-bounds.left,y:event.clientY-bounds.top};queue()
  }
  function leave(){pointer=null;queue()}
  function start(){reset();interacting=true}
  function end(){if(!interacting)return;interacting=false;remember()}
  function visibility(){if(document.hidden)reset()}
  function preference(){reset()}
  container.addEventListener('pointermove',move,{passive:true})
  container.addEventListener('pointerleave',leave,{passive:true})
  container.addEventListener('pointerdown',start,true)
  window.addEventListener('pointerup',end)
  window.addEventListener('pointercancel',end)
  window.addEventListener('blur',reset)
  document.addEventListener('visibilitychange',visibility)
  fine.addEventListener?.('change',preference);reduced.addEventListener?.('change',preference)
  graph.on('grab',start);graph.on('dragfree',end);graph.on('pan zoom layoutstart',reset)
  return {reset,destroy(){
    reset();destroyed=true
    container.removeEventListener('pointermove',move)
    container.removeEventListener('pointerleave',leave)
    container.removeEventListener('pointerdown',start,true)
    window.removeEventListener('pointerup',end);window.removeEventListener('pointercancel',end);window.removeEventListener('blur',reset)
    document.removeEventListener('visibilitychange',visibility)
    fine.removeEventListener?.('change',preference);reduced.removeEventListener?.('change',preference)
    graph.off('grab',start);graph.off('dragfree',end);graph.off('pan zoom layoutstart',reset)
  }}
}
