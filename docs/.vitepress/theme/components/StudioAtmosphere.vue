<template>
  <button v-if="finePointer" class="studio-pointer-toggle" type="button" :aria-pressed="customPointer" :aria-label="customPointer ? '切换为系统光标' : '启用几何光标'" :title="customPointer ? '切换为系统光标' : '启用几何光标'" @click="togglePointer">
    <MousePointer2 :size="18" aria-hidden="true" />
  </button>
</template>

<script setup>
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { MousePointer2 } from 'lucide-vue-next'

const finePointer = ref(false)
const customPointer = ref(true)
let fineMedia, reduceMedia, observer, mutations, frame = 0, hero = null
let scanQueued = false
const targets = '.community-links a,.home-work-grid > a,.home-community .rd-article,.catalog-card,.task-item'

function updatePointer() {
  finePointer.value = fineMedia.matches
  document.documentElement.classList.toggle('rd-pixel-pointer', finePointer.value && customPointer.value)
  resetParallax()
  if (reduceMedia.matches && observer) {
    document.querySelectorAll('.rd-reveal').forEach(el => el.classList.add('rd-revealed'))
    observer.disconnect()
  } else scan()
}
function togglePointer() {
  customPointer.value = !customPointer.value
  try { localStorage.setItem('rd-pixel-pointer', customPointer.value ? 'on' : 'off') } catch {}
  updatePointer()
}
function resetParallax() {
  cancelAnimationFrame(frame)
  frame = 0
  if (hero) { hero.style.removeProperty('--pointer-x'); hero.style.removeProperty('--pointer-y') }
  hero = null
}
function pointerMove(event) {
  if (!fineMedia.matches || reduceMedia.matches || event.pointerType !== 'mouse') return
  const element = event.target instanceof Element ? event.target.closest('.hero-fullscreen') : null
  if (!element) { if (hero) resetParallax(); return }
  if (frame) cancelAnimationFrame(frame)
  frame = requestAnimationFrame(() => {
    frame = 0
    hero = element
    const bounds = hero.getBoundingClientRect()
    hero.style.setProperty('--pointer-x', ((event.clientX - bounds.left) / bounds.width - .5) * 12 + 'px')
    hero.style.setProperty('--pointer-y', ((event.clientY - bounds.top) / bounds.height - .5) * 8 + 'px')
  })
}
function scan() {
  if (!observer || reduceMedia.matches) return
  document.querySelectorAll(targets).forEach((el, index) => {
    if (el.classList.contains('rd-reveal')) return
    el.classList.add('rd-reveal')
    el.style.setProperty('--reveal-delay', Math.min(index % 3 * 60, 120) + 'ms')
    observer.observe(el)
  })
}
function queueScan() {
  if (scanQueued) return
  scanQueued = true
  queueMicrotask(() => { scanQueued = false; scan() })
}
function visibilityChange() { if (document.hidden) resetParallax() }

onMounted(() => {
  fineMedia = matchMedia('(hover: hover) and (pointer: fine)')
  reduceMedia = matchMedia('(prefers-reduced-motion: reduce)')
  try { customPointer.value = localStorage.getItem('rd-pixel-pointer') !== 'off' } catch {}
  if ('IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      entries.forEach(({ isIntersecting, target }) => {
        if (!isIntersecting) return
        target.classList.add('rd-revealed')
        observer.unobserve(target)
      })
    }, { threshold: .08 })
    mutations = new MutationObserver(queueScan)
    mutations.observe(document.getElementById('app') || document.body, { childList: true, subtree: true })
  }
  fineMedia.addEventListener('change', updatePointer)
  reduceMedia.addEventListener('change', updatePointer)
  document.addEventListener('pointermove', pointerMove, { passive: true })
  document.addEventListener('pointerleave', resetParallax)
  document.addEventListener('visibilitychange', visibilityChange)
  window.addEventListener('blur', resetParallax)
  updatePointer()
})
onBeforeUnmount(() => {
  resetParallax()
  fineMedia?.removeEventListener('change', updatePointer)
  reduceMedia?.removeEventListener('change', updatePointer)
  document.removeEventListener('pointermove', pointerMove)
  document.removeEventListener('pointerleave', resetParallax)
  document.removeEventListener('visibilitychange', visibilityChange)
  window.removeEventListener('blur', resetParallax)
  observer?.disconnect()
  mutations?.disconnect()
  document.documentElement.classList.remove('rd-pixel-pointer')
  document.querySelectorAll('.rd-reveal').forEach(el => el.classList.add('rd-revealed'))
})
</script>
