import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import StudioAtmosphere from '../docs/.vitepress/theme/components/StudioAtmosphere.vue'

let wrapper, fine, reduced, disconnect
beforeEach(() => {
  localStorage.clear()
  fine = { matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }
  reduced = { matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }
  vi.stubGlobal('matchMedia', vi.fn(query => query.includes('reduced-motion') ? reduced : fine))
  disconnect = vi.fn()
  vi.stubGlobal('IntersectionObserver', class { observe() {} unobserve() {} disconnect=disconnect })
})
afterEach(() => { wrapper?.unmount(); document.body.innerHTML=''; vi.unstubAllGlobals(); localStorage.clear() })

it('provides a persistent native-cursor opt-out and cleans up global state', async () => {
  wrapper=mount(StudioAtmosphere)
  await flushPromises()
  expect(document.documentElement.classList.contains('rd-pixel-pointer')).toBe(true)
  await wrapper.get('button').trigger('click')
  expect(wrapper.get('button').attributes('aria-pressed')).toBe('false')
  expect(localStorage.getItem('rd-pixel-pointer')).toBe('off')
  expect(document.documentElement.classList.contains('rd-pixel-pointer')).toBe(false)
  await wrapper.get('button').trigger('click')
  wrapper.unmount()
  expect(document.documentElement.classList.contains('rd-pixel-pointer')).toBe(false)
  expect(disconnect).toHaveBeenCalled()
  expect(fine.removeEventListener).toHaveBeenCalledWith('change',expect.any(Function))
})

it('does not expose the cursor control on touch-only devices', () => {
  fine.matches=false
  wrapper=mount(StudioAtmosphere)
  expect(wrapper.find('button').exists()).toBe(false)
  expect(document.documentElement.classList.contains('rd-pixel-pointer')).toBe(false)
})

it('makes content visible immediately under reduced motion and responds to preference changes', async () => {
  document.body.innerHTML='<div id="app"><a class="rd-reveal">作品</a></div>'
  reduced.matches=true
  wrapper=mount(StudioAtmosphere)
  expect(document.querySelector('a').classList.contains('rd-revealed')).toBe(true)
  fine.matches=false
  fine.addEventListener.mock.calls[0][1]()
  await flushPromises()
  expect(wrapper.find('button').exists()).toBe(false)
})
