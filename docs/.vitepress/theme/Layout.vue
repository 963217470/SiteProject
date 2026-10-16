<template>
  <ReadingTracker />
  <CheckinDialog />
  <StudioAtmosphere />
  <DefaultTheme.Layout>
    <template #page-top><AdminNavigation /></template>
    <template #home-hero-before><HeroSection /></template>
    <template #home-features-after><CommunityLinks /><HomeCommunity /></template>
    <template #nav-bar-content-before><NavSelection /></template>
    <template #nav-screen-content-before><NavSelection /></template>
    <template #nav-bar-content-after><UserNav /></template>
  </DefaultTheme.Layout>
  <button v-if="!hideComposer" class="fab-button" aria-label="新建文章" title="新建文章" @click="goToEditor"><Plus :size="34" /></button>
</template>
<script setup>
import { computed } from 'vue'
import { useRoute } from 'vitepress'
import { Plus } from 'lucide-vue-next'
import DefaultTheme from 'vitepress/theme'
import UserNav from './components/UserNav.vue'
import NavSelection from './components/NavSelection.vue'
import AdminNavigation from './components/AdminNavigation.vue'
import ReadingTracker from './components/ReadingTracker.vue'
import CheckinDialog from './components/CheckinDialog.vue'
import StudioAtmosphere from './components/StudioAtmosphere.vue'
import HeroSection from './components/HeroSection.vue'
import HomeCommunity from './components/HomeCommunity.vue'
import CommunityLinks from './components/CommunityLinks.vue'
const route=useRoute()
const hideComposer=computed(()=>/^\/(?:admin|editor|mindmap|kb|articles|user\/profile)(?:\/|\.html|$)/.test(route.path))
function goToEditor(){window.location.assign('/editor')}
</script>
