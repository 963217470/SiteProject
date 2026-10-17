import http from 'node:http'
import https from 'node:https'
import { randomUUID } from 'node:crypto'
import { mkdtempSync, chmodSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { fork, execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { setTimeout as sleep } from 'node:timers/promises'
import { memory, cpuTicks, rss } from './server-capacity.mjs'

export function summarize(samples){
  const latencies=samples.map(s=>s.ms).sort((a,b)=>a-b),q=p=>latencies[Math.max(0,Math.ceil(latencies.length*p)-1)]||0,statuses={}
  for(const s of samples)statuses[s.status]=(statuses[s.status]||0)+1
  return {requests:samples.length,errors:samples.filter(s=>s.status!==200).length,statuses,p50:q(.5),p95:q(.95),p99:q(.99),max:q(1),bytes:samples.reduce((n,s)=>n+s.bytes,0)}
}

function request(origin,path,agent,simulatedClient=false){return new Promise(resolve=>{
  const started=performance.now(),url=new URL(path,origin),client=url.protocol==='https:'?https:http
  let bytes=0,finished=false
  const done=status=>{if(finished)return;finished=true;resolve({status,ms:performance.now()-started,bytes})}
  const req=client.get(url,{agent,headers:{'User-Agent':'RD-STUDIO-Bounded-Prelaunch-Test/1.0',...(simulatedClient?{'X-Forwarded-For':'198.18.'+Math.floor(Math.random()*10)+'.'+(1+Math.floor(Math.random()*250))}:{})}},res=>{
    const json=path.startsWith('/api/'),chunks=[]
    if(json&&res.statusCode===200&&!res.headers['content-type']?.includes('application/json')){done('invalid_content_type');res.resume();return}
    res.on('data',chunk=>{bytes+=chunk.length;if(json)chunks.push(chunk);if(bytes>10*1024*1024){req.destroy();done('body_limit')}})
    res.on('end',()=>{if(json&&res.statusCode===200){try{JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{done('invalid_json');return}}done(res.statusCode)});res.on('error',()=>done('read_error'))
  })
  const timer=setTimeout(()=>{done('timeout');req.destroy()},3000)
  req.on('error',()=>done('network_error'));req.on('close',()=>clearTimeout(timer))
})}

export async function main(output,syntheticArticles=0,scenario='mixed') {
  if(process.platform!=='linux'||!output)throw new Error('Run on the owned Linux server with an output JSON path')
  if(!/^\/tmp\/rd-prelaunch-[a-zA-Z0-9_-]+\.json$/.test(output)||existsSync(output))throw new Error('Use a new /tmp/rd-prelaunch-<name>.json report path')
  if(![0,1000].includes(syntheticArticles))throw new Error('Only the current dataset or 1000 synthetic notes are allowed')
  if(!['mixed','diagnostic'].includes(scenario))throw new Error('Unknown bounded scenario')
  const release='/opt/rd-studio/current',pid=Number(execFileSync('systemctl',['show','rd-studio','--property=MainPID','--value'],{encoding:'utf8'})),folder=mkdtempSync('/tmp/rd-prelaunch-')
  chmodSync(folder,0o700)
  const result={started:new Date().toISOString(),syntheticArticles,scenario,method:'bounded same-host test; no production content mutations or credentials; API saturation uses isolated database clone',limits:{requestTimeoutMs:3000,maxStageSeconds:20,minAvailableMemory:256*1024*1024,maxHostCpuPercent:95},stages:[],resources:[],stopped:null}
  const liveAgent=new https.Agent({keepAlive:true,maxSockets:20,lookup:(_host,options,callback)=>options.all?callback(null,[{address:'127.0.0.1',family:4}]):callback(null,'127.0.0.1',4)})
  const cloneAgent=new http.Agent({keepAlive:true,maxSockets:50})
  let child,monitor,lastTicks=cpuTicks(),highCpu=0,badHealth=0,monitorBusy=false,cloneOrigin
  const stop=reason=>{result.stopped ||= reason}
  const interrupted=()=>stop('Interrupted by operator')
  process.once('SIGINT',interrupted);process.once('SIGTERM',interrupted)
  try{
    if(memory().available<512*1024*1024)throw new Error('Insufficient baseline memory for isolated test')
    const db=new DatabaseSync('/var/lib/rd-studio/site.sqlite',{readOnly:true})
    try{db.prepare('VACUUM INTO ?').run(join(folder,'site.sqlite'))}finally{db.close()}
    child=fork(fileURLToPath(import.meta.url),['--clone-server',folder,release,String(syntheticArticles)],{stdio:['ignore','ignore','pipe','ipc']})
    cloneOrigin=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Clone startup timed out')),10000);child.once('message',message=>{clearTimeout(timer);resolve(message.origin)});child.once('exit',code=>{clearTimeout(timer);reject(new Error('Clone exited '+code))})})
    monitor=setInterval(async()=>{
      if(monitorBusy)return;monitorBusy=true
      try{
        const ticks=cpuTicks(),cpu=100*(1-(ticks.idle-lastTicks.idle)/Math.max(1,ticks.total-lastTicks.total));lastTicks=ticks
        const mem=memory(),health=await request('https://rd-studio.club','/api/health',liveAgent)
        result.resources.push({at:new Date().toISOString(),hostCpu:cpu,availableMemory:mem.available,swapUsed:mem.swapUsed,productionRss:rss(pid),cloneRss:rss(child.pid),generatorRss:process.memoryUsage().rss,productionHealthMs:health.ms,productionHealthStatus:health.status})
        highCpu=cpu>95?highCpu+1:0;badHealth=health.status!==200||health.ms>500?badHealth+1:0
        if(mem.available<256*1024*1024)stop('Available memory below 256 MiB')
        if(highCpu>=2)stop('Host CPU above 95% for two samples')
        if(badHealth>=2)stop('Production health failed or exceeded 500ms twice')
      }finally{monitorBusy=false}
    },2000)
    const api=['/api/data/articles?select=id,title,summary,first_image_url,tags,author_id&status=eq.published&visibility=eq.public&limit=12','/api/data/knowledge_branches?select=id,name,parent_id,description&limit=100','/api/knowledge/connections','/api/knowledge/creators','/api/catalog?scope=public','/api/activity/weekly']
    async function stage(name,origin,paths,concurrency,rps,seconds,simulated=false){
      if(result.stopped)return
      const started=performance.now(),end=started+seconds*1000,samples=[],pending=new Set(),batchSize=Math.min(concurrency,Math.max(1,Math.ceil(rps/4))),maxRequests=Math.ceil(seconds*rps);let issued=0,next=started,remaining=batchSize,peakInFlight=0
      while(performance.now()<end&&!result.stopped){
        if(issued>=maxRequests){await sleep(Math.max(1,Math.min(25,end-performance.now())));continue}
        if(pending.size>=concurrency){await Promise.race(pending);continue}
        if(performance.now()<next){await sleep(Math.min(25,next-performance.now()));continue}
        const path=paths[issued++%paths.length],promise=request(origin,path,origin===cloneOrigin?cloneAgent:liveAgent,simulated).then(sample=>{samples.push({...sample,route:path.split('?')[0]});if(sample.status!==200)stop(name+': unexpected '+sample.status)}).finally(()=>pending.delete(promise))
        pending.add(promise);peakInFlight=Math.max(peakInFlight,pending.size)
        if(--remaining===0){remaining=batchSize;next=Math.max(next+1000*batchSize/rps,performance.now())}
      }
      await Promise.all(pending)
      const elapsed=(performance.now()-started)/1000,summary=summarize(samples),byRoute={}
      for(const route of new Set(samples.map(s=>s.route)))byRoute[route]=summarize(samples.filter(s=>s.route===route))
      result.stages.push({name,concurrency,peakInFlight,targetRps:rps,elapsedSeconds:elapsed,...summary,actualRps:summary.requests/elapsed,byRoute})
      console.log(JSON.stringify({stage:name,requests:summary.requests,rps:summary.requests/elapsed,p95:summary.p95,errors:summary.errors}))
      if(summary.p95>1000)stop(name+': p95 exceeded 1 second')
      await sleep(1500)
    }
    const live='https://rd-studio.club'
    if(scenario==='diagnostic'){
      await stage('clone-scaled-steady-30rps',cloneOrigin,api,5,30,20,true)
      await stage('clone-list-without-image',cloneOrigin,[api[0].replace(',first_image_url','')],1,2,3,true)
      await stage('clone-list-with-image',cloneOrigin,[api[0]],1,2,3,true)
      await stage('clone-creators',cloneOrigin,['/api/knowledge/creators'],1,2,3,true)
    }else{
    if(!syntheticArticles){
      await stage('production-api-smoke',live,api,2,4,5)
      for(const [c,r] of [[1,10],[5,40],[10,80]])await stage('production-static-c'+c,live,['/','/articles/','/kb/','/games-tools/'],c,r,4)
      await stage('production-cover',live,['/images/hero-bg.jpg'],2,4,3)
    }
    for(const [c,r] of [[1,10],[5,30],[10,60],[25,120],[50,200]])await stage('clone-api-c'+c,cloneOrigin,api,c,r,6,true)
    await stage('clone-steady',cloneOrigin,api,10,60,20,true)
    }
  }catch(error){result.stopped ||= error.message}
  finally{
    process.removeListener('SIGINT',interrupted);process.removeListener('SIGTERM',interrupted)
    clearInterval(monitor)
    while(monitorBusy)await sleep(20)
    liveAgent.destroy();cloneAgent.destroy()
    if(child&&child.exitCode===null){const ended=new Promise(resolve=>child.once('exit',resolve));child.kill('SIGTERM');await Promise.race([ended,sleep(3000)]);if(child.exitCode===null){child.kill('SIGKILL');await ended}}
    if(folder.startsWith('/tmp/rd-prelaunch-'))rmSync(folder,{recursive:true,force:true})
    result.cloneCleaned=true
    result.finished=new Date().toISOString();writeFileSync(output,JSON.stringify(result,null,2),{mode:0o600,flag:'wx'})
  }
  console.log(JSON.stringify({report:output,stopped:result.stopped,stages:result.stages.length}))
}

if(process.argv[1]===fileURLToPath(import.meta.url)) {
  if(process.argv[2]==='--clone-server') {
    if(!process.send)throw new Error('Clone may only be launched by the bounded runner')
    const folder=process.argv[3],release=process.argv[4]
    const {openDatabase}=await import(pathToFileURL(join(release,'server/database.mjs'))),{createApp}=await import(pathToFileURL(join(release,'server/app.mjs')))
    const db=openDatabase(join(folder,'site.sqlite')),count=Number(process.argv[5]||0)
    if(count){
      const owner=randomUUID(),branchIds=Array.from({length:100},()=>randomUUID())
      const content='# Synthetic load-test note\n\n![Cover](/images/hero-bg.jpg)\n\n'+('## Engine workflow\n\nCreate, test and share a game prototype. Keep code and notes together.\n\n```js\nconst speed = 5;\n```\n\n').repeat(48)
      db.exec('BEGIN IMMEDIATE')
      try{
        db.prepare('INSERT INTO users(id,github_id,github_username) VALUES(?,?,?)').run(owner,'load-'+owner,'load-fixture')
        db.prepare('INSERT INTO profiles(id,username,role) VALUES(?,?,?)').run(owner,'load-fixture','user')
        const branch=db.prepare('INSERT INTO knowledge_branches(id,parent_id,name,slug,description,created_by) VALUES(?,?,?,?,?,?)')
        for(let i=0;i<100;i++)branch.run(branchIds[i],i<10?null:branchIds[i%10],'Synthetic branch '+i,'load-'+i,'Synthetic benchmark only',owner)
        const note=db.prepare("INSERT INTO articles(id,title,summary,content,author_id,status,visibility,kb_enabled,kb_branch_id) VALUES(?,?,?,?,?,'published','public',1,?)")
        for(let i=0;i<count;i++)note.run(randomUUID(),'Synthetic note '+i,'Synthetic benchmark only',content,owner,branchIds[i%100])
        db.exec('COMMIT')
      }catch(error){db.exec('ROLLBACK');throw error}
      const {flushCommunity}=await import(pathToFileURL(join(release,'server/community.mjs')))
      flushCommunity(db,Date.now)
    }
    const server=createApp(db,{dataDir:folder,sessionSecret:randomUUID()+randomUUID(),siteUrl:'http://127.0.0.1',production:false,maxUploadMb:1,adminGithubIds:[]}).listen(0,'127.0.0.1',()=>process.send({origin:'http://127.0.0.1:'+server.address().port}))
    let closing=false
    const shutdown=()=>{if(closing)return;closing=true;server.closeAllConnections();server.close(()=>{db.close();process.exit(0)})}
    process.once('SIGTERM',shutdown);process.once('disconnect',shutdown)
  } else await main(process.argv[2],Number(process.argv[3]||0),process.argv[4]||'mixed')
}
