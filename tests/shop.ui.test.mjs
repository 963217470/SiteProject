import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ShopCenter from '../docs/.vitepress/theme/components/ShopCenter.vue'
import { communityRequest } from '../docs/.vitepress/theme/lib/community-api.mjs'
vi.mock('../docs/.vitepress/theme/lib/community-api.mjs',()=>({communityRequest:vi.fn()}))
let wrapper,identity,products,orders,authCallback
const rules={article_likes:10,article_reward:0,streak_reward:0,earning_enabled:false,redemptions_enabled:true}
beforeEach(()=>{
  history.replaceState({},'','/shop/')
  HTMLDialogElement.prototype.showModal=function(){this.open=true};HTMLDialogElement.prototype.close=function(){this.open=false}
  identity={balance:10,role:'member',rules}
  products=[{id:'sticker',title:'RD 贴纸',description:'社团原创贴纸',category:'周边',price:5,stock:2,status:'published',revision:1,cover_url:'/images/rd-studio-logo.png'}]
  orders=[]
  window.__api={auth:{onAuthStateChange:cb=>{authCallback=cb;return {data:{subscription:{unsubscribe:vi.fn()}}}}}}
  communityRequest.mockReset().mockImplementation(async(path,options)=>{
    if(path==='/shop/me'){if(!identity)throw Object.assign(new Error('请先登录'),{status:401});return identity}
    if(path.startsWith('/shop/products')||path.startsWith('/shop/admin/products?'))return {items:products,has_more:false,categories:['周边'],rules:identity?.rules || rules}
    if(path==='/shop/orders'&&options){identity.balance-=5;orders=[{id:'order',product_title:'RD 贴纸',price:5,status:'pending',created_at:Date.now()}];return {order:orders[0],balance:identity.balance}}
    if(path.startsWith('/shop/orders?')||path.startsWith('/shop/admin/orders?'))return {items:orders,has_more:false}
    if(path.startsWith('/shop/ledger?'))return {items:[{id:'credit',amount:5,reason:'文章获赞奖励',created_at:Date.now()}],has_more:false}
    return {ok:true}
  })
})
afterEach(()=>{wrapper?.unmount();delete window.__api;history.replaceState({},'','/')})
async function render(props={}){wrapper=mount(ShopCenter,{props});await flushPromises()}
it('shows test branding, real wallet, public products and independent coin rules',async()=>{
  await render();expect(wrapper.get('.shop-test').text()).toBe('测试')
  expect(wrapper.get('.shop-wallet').text()).toContain('10 币')
  expect(wrapper.get('.shop-product h2').text()).toBe('RD 贴纸')
  expect(wrapper.get('.shop-rules').text()).toContain('获取渠道暂未开放')
  expect(wrapper.get('.shop-cover img').attributes('src')).toBe('/images/rd-studio-logo.png')
  await wrapper.get('.shop-cover img').trigger('error');expect(wrapper.find('.shop-cover img').exists()).toBe(false)
})
it('display-only mode exposes products and ledger but has no active redemption control',async()=>{
  identity.rules={...rules,redemptions_enabled:false};await render()
  expect(wrapper.findAll('.shop-tabs button').map(button=>button.text())).toEqual(['商品','收支明细'])
  expect(wrapper.get('.shop-rules').text()).toContain('获取渠道暂未开放')
  await wrapper.get('.shop-cover').trigger('click');await flushPromises()
  const dialog=wrapper.get('dialog[aria-labelledby="shop-detail-title"]')
  expect(dialog.get('.shop-button').text()).toContain('兑换暂未开放')
  expect(dialog.get('.shop-button').attributes('disabled')).toBeDefined()
  expect(dialog.find('textarea').exists()).toBe(false)
  expect(communityRequest.mock.calls.some(([path,options])=>path==='/shop/orders'&&options)).toBe(false)
})
it('keeps anonymous shopping readable but requires login for redemptions and private records',async()=>{
  identity=null;await render();expect(wrapper.find('.shop-product').exists()).toBe(true)
  await wrapper.get('.shop-cover').trigger('click');await flushPromises()
  expect(wrapper.get('dialog[aria-labelledby="shop-detail-title"]').text()).toContain('登录后兑换')
  await wrapper.findAll('.shop-tabs button')[1].trigger('click');await flushPromises()
  expect(wrapper.text()).toContain('登录后查看兑换记录')
})
it('requires confirmation, debits only on redemption and then shows the order',async()=>{
  await render();await wrapper.get('.shop-cover').trigger('click');await flushPromises()
  expect(identity.balance).toBe(10)
  await wrapper.get('dialog[aria-labelledby="shop-detail-title"] textarea').setValue('线下领取')
  await wrapper.get('dialog[aria-labelledby="shop-detail-title"] .shop-primary').trigger('click');await flushPromises()
  expect(communityRequest).toHaveBeenCalledWith('/shop/orders',expect.objectContaining({method:'POST',body:expect.objectContaining({product_id:'sticker',expected_revision:1,note:'线下领取',request_key:expect.any(String)})}))
  expect(wrapper.get('.shop-wallet').text()).toContain('5 币')
  expect(wrapper.get('.shop-order').text()).toContain('待处理')
})
it('disables redemption when balance is insufficient and retains the same retry key on network failure',async()=>{
  identity.balance=0;await render();await wrapper.get('.shop-cover').trigger('click');await flushPromises()
  expect(wrapper.get('dialog[aria-labelledby="shop-detail-title"] .shop-primary').attributes('disabled')).toBeDefined()
  wrapper.unmount();identity.balance=10;await render();await wrapper.get('.shop-cover').trigger('click');await flushPromises()
  const original=communityRequest.getMockImplementation()
  communityRequest.mockImplementation(async(path,options)=>{if(path==='/shop/orders'&&options)throw new Error('网络中断');return original(path,options)})
  for(let i=0;i<2;i++){await wrapper.get('dialog[aria-labelledby="shop-detail-title"] .shop-primary').trigger('click');await flushPromises()}
  const calls=communityRequest.mock.calls.filter(([path,options])=>path==='/shop/orders'&&options)
  expect(calls).toHaveLength(2);expect(calls[0][1].body.request_key).toBe(calls[1][1].body.request_key)
  expect(identity.balance).toBe(10)
})
it('protects admin view and supports administrator-defined product fields with revision checking',async()=>{
  await render({adminView:true});expect(wrapper.text()).toContain('需要管理员权限')
  wrapper.unmount();identity.role='admin';await render({adminView:true})
  await wrapper.get('.shop-product-actions button').trigger('click');await flushPromises()
  const dialog=wrapper.get('dialog[aria-labelledby="shop-edit-title"]')
  const inputs=dialog.findAll('input');await inputs[0].setValue('自定义商品')
  await dialog.get('form').trigger('submit');await flushPromises()
  expect(communityRequest).toHaveBeenCalledWith('/shop/admin/products/sticker',expect.objectContaining({method:'PUT',body:expect.objectContaining({title:'自定义商品',price:5,stock:2,expected_revision:1})}))
})
it('clears private state on account change and renders ledger entries',async()=>{
  await render();await wrapper.findAll('.shop-tabs button')[2].trigger('click');await flushPromises()
  expect(wrapper.get('.shop-ledger-row').text()).toContain('+5 币')
  identity=null;authCallback('SIGNED_OUT');await flushPromises()
  expect(wrapper.find('.shop-ledger-row').exists()).toBe(false)
  expect(wrapper.get('.shop-wallet').text()).not.toContain('10 币')
})
