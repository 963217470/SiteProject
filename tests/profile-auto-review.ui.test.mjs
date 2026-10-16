import { readFileSync } from 'node:fs'
import { afterEach, expect, it, vi } from 'vitest'
import { flushPromises } from '@vue/test-utils'

afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();document.body.innerHTML='';history.replaceState({},'','/');delete window.__supabase;delete window.setProfileTab;delete window.saveProfileSettings})

async function open(role){
  vi.useFakeTimers({toFake:['setTimeout','setInterval','clearInterval']})
  history.replaceState({},'','/user/profile?tab=settings')
  document.body.innerHTML='<div id="profile-page"></div>'
  const profile={id:'test',username:'Original',avatar_url:'/old.png',bio:'Old',role}
  const inserted=vi.fn(),updated=vi.fn()
  window.addEventListener('rd:profile-updated',updated,{once:true})
  vi.stubGlobal('fetch',vi.fn(async()=>({ok:false,json:async()=>({})})))
  window.__supabase={auth:{getSession:async()=>({data:{session:{user:{id:'test',user_metadata:{}}}}})},reading:{history:async()=>({data:{items:[]}})},from(table){
    let payload
    const query={select:()=>query,eq:()=>query,order:()=>query,in:()=>query,insert:value=>{payload=value;inserted(value);return query},maybeSingle:async()=>({data:profile}),single:async()=>({data:{...payload,id:'change',status:role==='admin'?'approved':'pending'}}),then:resolve=>Promise.resolve({data:[]}).then(resolve)}
    return query
  }}
  window.eval(readFileSync('docs/public/profile-page.js','utf8'))
  document.dispatchEvent(new Event('DOMContentLoaded'));await vi.advanceTimersByTimeAsync(1);await flushPromises()
  return {inserted,updated}
}

it('admin settings save updates the visible profile immediately using the approved server response',async()=>{
  const {inserted,updated}=await open('admin')
  expect(document.getElementById('settings-submit').textContent).toBe('保存资料')
  document.getElementById('settings-username').value='New admin'
  document.getElementById('settings-bio').value='New bio'
  document.getElementById('settings-avatar').dataset.uploadedUrl='/api/files/avatars/test/new.png'
  await window.saveProfileSettings();await flushPromises()
  expect(inserted).toHaveBeenCalledOnce()
  expect(document.getElementById('settings-success').textContent).toContain('自动通过')
  expect(document.getElementById('profile-name').textContent).toBe('New admin')
  expect(document.getElementById('profile-bio').textContent).toBe('New bio')
  expect(document.getElementById('profile-avatar').getAttribute('src')).toContain('/test/new.png')
  expect(updated).toHaveBeenCalledOnce()
})

it('member settings stay pending and do not replace the publicly visible profile',async()=>{
  await open('user')
  expect(document.getElementById('settings-submit').textContent).toBe('提交审核')
  document.getElementById('settings-username').value='Pending name'
  await window.saveProfileSettings();await flushPromises()
  expect(document.getElementById('settings-success').textContent).toContain('等待管理员审核')
  expect(document.getElementById('profile-name').textContent).toBe('Original')
})
