import os from 'node:os'
import { readFileSync, statfsSync, existsSync, readdirSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'

export function memory() {
  const values=Object.fromEntries([...readFileSync('/proc/meminfo','utf8').matchAll(/^(\w+):\s+(\d+) kB/gm)].map(m=>[m[1],Number(m[2])*1024]))
  return {total:values.MemTotal,available:values.MemAvailable,swapTotal:values.SwapTotal,swapUsed:values.SwapTotal-values.SwapFree}
}
export function cpuTicks(){const row=readFileSync('/proc/stat','utf8').split('\n')[0].trim().split(/\s+/).slice(1,9).map(Number);return {total:row.reduce((a,b)=>a+b,0),idle:row[3]+row[4]}}
export function rss(pid){try{return Number(readFileSync('/proc/'+pid+'/status','utf8').match(/^VmRSS:\s+(\d+)/m)?.[1]||0)*1024}catch{return 0}}
export function capacity(database='/var/lib/rd-studio/site.sqlite') {
  const disk=statfsSync('/'),sizes={}
  for(const path of ['/var/lib/rd-studio','/opt/rd-studio/releases','/var/backups/rd-studio','/www/wwwroot/rd-studio.club/releases','/www/wwwlogs'])if(existsSync(path))sizes[path]=Number(execFileSync('du',['-sx','--block-size=1',path],{encoding:'utf8',timeout:30000}).split(/\s+/)[0])
  const db=new DatabaseSync(database,{readOnly:true}),counts={}
  try{for(const table of ['users','articles','knowledge_branches','catalog_items','files','tasks'])counts[table]=db.prepare('SELECT count(*) n FROM '+table).get().n;counts.publishedArticles=db.prepare("SELECT count(*) n FROM articles WHERE status='published'").get().n;counts.fileBytes=db.prepare('SELECT coalesce(sum(size),0) n FROM files').get().n;counts.integrity=db.prepare('PRAGMA quick_check').get().quick_check;counts.schema=db.prepare('PRAGMA user_version').get().user_version}finally{db.close()}
  const processRows=execFileSync('ps',['-eo','pid,comm,%cpu,%mem,rss','--sort=-rss'],{encoding:'utf8'}).trim().split('\n').slice(0,13)
  const service=execFileSync('systemctl',['show','rd-studio','--property=ActiveState,MainPID,MemoryCurrent,TasksCurrent,LimitNOFILE,NRestarts'],{encoding:'utf8'}).trim().split('\n')
  return {at:new Date().toISOString(),temporaryTestDirectories:readdirSync('/tmp',{withFileTypes:true}).filter(entry=>entry.isDirectory()&&entry.name.startsWith('rd-prelaunch-')).length,cpu:{logical:os.cpus().length,model:os.cpus()[0]?.model,loadAverage:os.loadavg()},memory:memory(),disk:{total:Number(disk.blocks)*Number(disk.bsize),available:Number(disk.bavail)*Number(disk.bsize),free:Number(disk.bfree)*Number(disk.bsize),inodes:disk.files,freeInodes:disk.ffree},directoryBytes:sizes,database:counts,topProcesses:processRows,service}
}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(capacity(process.argv[2]),null,2))
