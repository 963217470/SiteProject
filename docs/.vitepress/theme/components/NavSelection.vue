<template><span ref="marker" hidden /></template>

<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useData } from 'vitepress'
import '../navigation.css'

const {page,theme}=useData()
const marker=ref(null)
const activeHref=computed(()=>{
  const path='/'+String(page.value.relativePath||'').replace(/(?:^|\/)index\.md$/,'').replace(/\.md$/,'')
  return theme.value.nav?.find(item=>item.link && item.activeMatch && new RegExp(item.activeMatch).test(path))?.link||''
})
const normalize=value=>value.replace(/\/+$/,'')||'/'
async function updateSelection() {
  await nextTick()
  const nav=marker.value?.closest('.VPNavBar,.VPNavScreen')
  nav?.querySelectorAll('.VPNavBarMenuLink,.VPNavScreenMenuLink').forEach(link=>{
    if(activeHref.value && normalize(new URL(link.href,location.origin).pathname)===normalize(activeHref.value))link.setAttribute('aria-current','page')
    else link.removeAttribute('aria-current')
  })
}
onMounted(updateSelection)
watch(activeHref,updateSelection,{flush:'post'})
</script>
