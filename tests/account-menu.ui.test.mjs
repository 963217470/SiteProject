import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import UserNav from '../docs/.vitepress/theme/components/UserNav.vue'

vi.mock('vitepress', () => ({ useRoute: () => ({ path: '/' }) }))
let wrapper
let callback
let unsubscribe
let signOut
const profile = { username: '社员', avatar_url: '/images/default-avatar.svg', role: 'user' }
beforeEach(() => {
  unsubscribe = vi.fn()
  signOut = vi.fn().mockResolvedValue({ error: { message: '网络连接失败' } })
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: profile }) }
  window.__api = {
    from: () => query,
    auth: { signOut, onAuthStateChange: cb => { callback = cb; return { data: { subscription: { unsubscribe } } } } }
  }
  wrapper = mount(UserNav, { attachTo: document.body })
})
afterEach(() => { wrapper.unmount(); document.body.innerHTML = ''; delete window.__api })
async function login(role = 'user') {
  await callback('INITIAL_SESSION', { user: { id: 'test', user_metadata: { user_name: '社员' }, app_metadata: { role } } })
  await flushPromises()
}
describe('Account menu', () => {
  it('renders a login link for anonymous readers', async () => {
    await callback('INITIAL_SESSION', null)
    await flushPromises()
    expect(wrapper.get('.login-link').attributes('href')).toBe('/login')
  })
  it('supports arrow-key opening, navigation and Escape focus restoration', async () => {
    await login()
    await wrapper.get('.user-menu').trigger('keydown', { key: 'ArrowDown' })
    await flushPromises()
    expect(document.activeElement.textContent).toContain('个人主页')
    await wrapper.get('.user-dropdown').trigger('keydown', { key: 'ArrowDown' })
    expect(document.activeElement.textContent).toContain('我的发布')
    await wrapper.trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('.user-dropdown').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('.user-menu').element)
  })
  it('links history and settings, without exposing admin navigation to members', async () => {
    await login()
    await wrapper.get('.user-menu').trigger('click')
    expect(wrapper.find('a[href="/user/profile?tab=recent"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/user/profile?tab=settings"]').exists()).toBe(true)
    expect(wrapper.find('a[href="/admin"]').exists()).toBe(false)
  })
  it('keeps the menu and reports a failed logout', async () => {
    await login()
    await wrapper.get('.user-menu').trigger('click')
    await wrapper.get('.logout').trigger('click')
    await flushPromises()
    expect(wrapper.get('[role="alert"]').text()).toBe('网络连接失败')
    expect(wrapper.find('.user-menu').exists()).toBe(true)
    expect(signOut).toHaveBeenCalledOnce()
  })
  it('closes on outside input and unsubscribes on unmount', async () => {
    await login()
    await wrapper.get('.user-menu').trigger('click')
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await flushPromises()
    expect(wrapper.find('.user-dropdown').exists()).toBe(false)
    wrapper.unmount()
    expect(unsubscribe).toHaveBeenCalledOnce()
  })
})
