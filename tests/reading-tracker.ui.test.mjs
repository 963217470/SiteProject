import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import ReadingTracker from '../docs/.vitepress/theme/components/ReadingTracker.vue'

let wrapper, client, focus
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
  document.body.innerHTML = '<main id="article-page" data-reading-article="one"></main>'
  focus = vi.spyOn(document, 'hasFocus').mockReturnValue(true)
  client = { auth: { getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'test' } } } }) }, reading: {
    start: vi.fn().mockResolvedValue({ data: { id: 'reading-one' } }),
    tick: vi.fn().mockResolvedValue({ data: { credited_seconds: 0 } })
  } }
  window.__api = client
})
afterEach(() => { wrapper?.unmount(); vi.restoreAllMocks(); vi.useRealTimers(); document.body.innerHTML = ''; delete window.__api })
it('starts an authorized article session and marks blurred activity inactive', async () => {
  wrapper = mount(ReadingTracker)
  await flushPromises()
  expect(client.reading.start).toHaveBeenCalledWith('one')
  expect(client.reading.tick).toHaveBeenLastCalledWith('reading-one', { active: true })
  focus.mockReturnValue(false)
  window.dispatchEvent(new Event('blur'))
  await flushPromises()
  expect(client.reading.tick).toHaveBeenLastCalledWith('reading-one', { active: false })
})
it('does not create history for anonymous readers', async () => {
  client.auth.getSession.mockResolvedValue({ data: { session: null } })
  wrapper = mount(ReadingTracker)
  await flushPromises()
  expect(client.reading.start).not.toHaveBeenCalled()
})
it('stops idle credit and closes sessions and timers on unmount', async () => {
  wrapper = mount(ReadingTracker)
  await flushPromises()
  await vi.advanceTimersByTimeAsync(125000)
  expect(client.reading.tick).toHaveBeenLastCalledWith('reading-one', { active: false })
  wrapper.unmount()
  expect(client.reading.tick).toHaveBeenLastCalledWith('reading-one', { active: false, closed: true })
  const calls = client.reading.tick.mock.calls.length
  await vi.advanceTimersByTimeAsync(30000)
  expect(client.reading.tick.mock.calls.length).toBe(calls)
})
