const { chromium } = require('playwright')
const { createHash } = require('node:crypto')
const { readFileSync } = require('node:fs')
const { tmpdir } = require('node:os')
const { join } = require('node:path')

async function main() {
  const response=await fetch('https://rd-studio.club/mcp/rd-studio-mcp.zip')
  if(!response.ok)throw new Error('Download status '+response.status)
  const remote=createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex')
  const local=createHash('sha256').update(readFileSync('docs/public/mcp/rd-studio-mcp.zip')).digest('hex')
  if(remote!==local)throw new Error('Download checksum mismatch')
  console.log('Public download SHA256 verified: '+remote)
  const browser=await chromium.launch({channel:'msedge',headless:true,args:['--disable-gpu']})
  try {
    for(const width of [1440,390]) {
      const page=await browser.newPage({viewport:{width,height:900}})
      await page.goto('https://rd-studio.club/mcp/',{waitUntil:'domcontentloaded',timeout:20000})
      if(await page.locator('a[href="/mcp/rd-studio-mcp.zip"]').count()!==1)throw new Error('Missing download link')
      if(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth))throw new Error('Horizontal overflow at '+width)
      await page.screenshot({path:join(tmpdir(),'rd-mcp-'+width+'.png'),fullPage:true})
      console.log('Guide verified at '+width+'px: '+await page.title())
      await page.close()
    }
  } finally {await browser.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1})
