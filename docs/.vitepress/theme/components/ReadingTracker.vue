<template><span hidden aria-hidden="true"></span></template>

<script setup>
import { onMounted, onUnmounted } from 'vue'

let observer, interval, session, currentArticle, generation = 0, pending = false
let lastActivity = Date.now()
const events = ['pointerdown', 'keydown', 'scroll', 'pointermove']
function active() { return document.visibilityState === 'visible' && document.hasFocus() && Date.now() - lastActivity < 120000 }
function activity() { lastActivity = Date.now() }
async function tick() {
  if (!session || pending) return
  pending = true
  const id = session
  try {
    const result = await window.__api.reading.tick(id, { active: active() })
    if (result.error && [401, 403, 404].includes(result.error.status) && id === session) session = null
  } finally { pending = false }
}
function close() {
  if (session) window.__api.reading.tick(session, { active: false, closed: true })
  session = null
}
async function syncArticle() {
  const id = document.querySelector('#article-page')?.dataset.readingArticle || ''
  if (id === currentArticle) return
  const token = ++generation
  close()
  currentArticle = id
  if (!id || !window.__api?.reading) return
  const auth = await window.__api.auth.getSession()
  if (token !== generation || !auth.data?.session) return
  const result = await window.__api.reading.start(id)
  if (token !== generation) {
    if (result.data?.id) window.__api.reading.tick(result.data.id, { active: false, closed: true })
    return
  }
  session = result.data?.id || null
  lastActivity = Date.now()
  await tick()
}
function visibilityChanged() { tick() }
function focusChanged() { lastActivity = Date.now(); tick() }
onMounted(() => {
  observer = new MutationObserver(syncArticle)
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['data-reading-article'] })
  events.forEach(event => window.addEventListener(event, activity, { passive: true }))
  document.addEventListener('visibilitychange', visibilityChanged)
  window.addEventListener('blur', visibilityChanged)
  window.addEventListener('focus', focusChanged)
  window.addEventListener('pagehide', close)
  interval = setInterval(tick, 15000)
  syncArticle()
})
onUnmounted(() => {
  ++generation
  close()
  observer?.disconnect()
  clearInterval(interval)
  events.forEach(event => window.removeEventListener(event, activity))
  document.removeEventListener('visibilitychange', visibilityChanged)
  window.removeEventListener('blur', visibilityChanged)
  window.removeEventListener('focus', focusChanged)
  window.removeEventListener('pagehide', close)
})
</script>
