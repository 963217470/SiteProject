<template>
  <DefaultTheme.Layout>
    <template #home-hero-before>
      <HeroSection />
    </template>
    <template #home-features-after>
      <HomeArticles />
    </template>
    <template #nav-bar-content-after>
      <UserNav />
    </template>
  </DefaultTheme.Layout>
  
  <button class="fab-button" @click="goToEditor">
    <span class="fab-icon">+</span>
  </button>
</template>

<script setup>
import { onMounted, onUnmounted } from 'vue'
import DefaultTheme from 'vitepress/theme'

function goToEditor() {
  window.location.href = '/editor'
}
import UserNav from './components/UserNav.vue'
import HeroSection from './components/HeroSection.vue'
import HomeArticles from './components/HomeArticles.vue'

onMounted(() => {
  // 导航栏标题 RD/STUDIO 着色
  function splitNavTitle() {
    var spans = document.querySelectorAll('.VPNavBarTitle span')
    for (var i = 0; i < spans.length; i++) {
      var s = spans[i]
      if (s.dataset.split || s.children.length > 0) continue
      if (s.textContent.trim() !== 'RD STUDIO') continue
      s.dataset.split = '1'
      s.innerHTML = '<span class="nav-rd">RD</span> <span class="nav-studio">STUDIO</span>'
    }
  }

  var obs = new MutationObserver(splitNavTitle)
  obs.observe(document.body, { childList: true, subtree: true, characterData: true })
  splitNavTitle()
  setInterval(splitNavTitle, 500)

  // 首页顶部搜索框样式重置（必须用 JS，CSS 无法覆盖 @docsearch/css）
  function setSearchTransparent(btn, transparent) {
    if (!btn) return
    if (transparent) {
      btn.style.cssText = 'background:transparent!important;color:white!important;border:1px solid rgba(255,255,255,0.3)!important;box-shadow:none!important;'
      var keysContainer = btn.querySelector('.DocSearch-Button-Keys')
      if (keysContainer) keysContainer.style.cssText = 'border:1px solid rgba(255,255,255,0.3)!important;border-radius:6px!important;padding:0 4px!important;'
      var keys = btn.querySelectorAll('.DocSearch-Button-Key')
      for (var i = 0; i < keys.length; i++) keys[i].style.cssText = 'background:transparent!important;box-shadow:none!important;border:none!important;color:rgba(255,255,255,0.6)!important;margin-right:0!important;'
      var icon = btn.querySelector('.DocSearch-Search-Icon')
      if (icon) icon.style.color = 'rgba(255,255,255,0.8)'
      var placeholder = btn.querySelector('.DocSearch-Button-Placeholder')
      if (placeholder) placeholder.style.color = 'rgba(255,255,255,0.6)'
    } else {
      btn.style.cssText = ''
      var keysContainer = btn.querySelector('.DocSearch-Button-Keys')
      if (keysContainer) keysContainer.style.cssText = ''
      var keys = btn.querySelectorAll('.DocSearch-Button-Key')
      for (var i = 0; i < keys.length; i++) keys[i].style.cssText = ''
      var icon = btn.querySelector('.DocSearch-Search-Icon')
      if (icon) icon.style.color = ''
      var placeholder = btn.querySelector('.DocSearch-Button-Placeholder')
      if (placeholder) placeholder.style.color = ''
    }
  }

  // 导航栏：首页顶部透明，滚动后变实色；其他页面始终显示
  function handleScroll() {
    var nav = document.querySelector('.VPNav')
    if (!nav) return
    var searchBtn = nav.querySelector('.DocSearch-Button')
    var isHome = !!document.querySelector('.is-home')
    if (isHome) {
      if (window.scrollY === 0) {
        nav.classList.remove('nav-scrolled')
        nav.classList.add('nav-at-top')
        setSearchTransparent(searchBtn, true)
      } else {
        nav.classList.add('nav-scrolled')
        nav.classList.remove('nav-at-top')
        setSearchTransparent(searchBtn, false)
      }
    } else {
      nav.classList.remove('nav-scrolled')
      nav.classList.remove('nav-at-top')
      setSearchTransparent(searchBtn, false)
    }
  }

  window.addEventListener('scroll', handleScroll, { passive: true })
  handleScroll()

  // 首页：强制去掉内容区顶部间距
  function removeHomeGap() {
    if (document.querySelector('.is-home')) {
      var vc = document.getElementById('VPContent')
      if (vc) vc.style.paddingTop = '0'
    }
  }
  removeHomeGap()
  setInterval(removeHomeGap, 300)
})

</script>

<style>
/* 隐藏默认 Hero，用自定义 HeroSection 替代 */
.VPHomeHero {
  display: none !important;
}

/* 首页去掉顶部空白 */
.VPSkipLink,
.Layout > span {
  display: none !important;
  height: 0 !important;
  margin: 0 !important;
  padding: 0 !important;
}

.is-home .VPContent,
.is-home .VPHome,
.is-home .Layout {
  padding-top: 0 !important;
  margin-top: 0 !important;
}

/* 首页 body 和 html 无间距 */
html, body {
  margin: 0 !important;
  padding: 0 !important;
}

/* 首页导航栏：顶部透明，滚动后变实色 */
.VPNav.nav-at-top .VPNavBar,
.is-home .VPNav .VPNavBar {
  background: transparent !important;
  border-bottom: none !important;
  transition: background 0.3s ease, box-shadow 0.3s ease;
}
.VPNav.nav-scrolled .VPNavBar,
.is-home .VPNav.nav-scrolled .VPNavBar {
  background: var(--vp-c-bg) !important;
  border-bottom: 1px solid var(--vp-c-divider) !important;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.06);
}

/* 首页导航栏顶部时：白色文字和透明搜索框 */
.VPNav.nav-at-top .VPNavBarMenuLink,
.VPNav.nav-at-top .VPNavBarMenuLink span,
.VPNav.nav-at-top .VPNavBarMenu a,
.VPNav.nav-at-top .VPNavBarMenu button,
.VPNav.nav-at-top .VPNavBarMenuGroup button,
.VPNav.nav-at-top .VPNavBarTitle,
.VPNav.nav-at-top .VPNavBarTitle span,
.VPNav.nav-at-top .title,
.VPNav.nav-at-top .VPNavBarAppearance,
.VPNav.nav-at-top .VPNavBarHamburger,
.VPNav.nav-at-top .VPNavBarHamburger span {
  color: white !important;
}
.VPNav.nav-at-top .DocSearch-Button {
  background: transparent !important;
  color: white !important;
  border: 1px solid rgba(255, 255, 255, 0.3) !important;
  box-shadow: none !important;
  --docsearch-searchbox-background: transparent;
  --docsearch-searchbox-focus-background: transparent;
  --docsearch-key-gradient: rgba(0,0,0,0.3);
  --docsearch-key-shadow: none;
  --docsearch-muted-color: rgba(255,255,255,0.6);
  --docsearch-text-color: white;
}
.VPNav.nav-at-top .DocSearch-Button:hover {
  border-color: rgba(255, 255, 255, 0.6) !important;
}
.VPNav.nav-at-top .DocSearch-Button-Key {
  background: rgba(0,0,0,0.3) !important;
  box-shadow: none !important;
  color: rgba(255,255,255,0.6) !important;
}
.VPNav.nav-at-top .DocSearch-Search-Icon {
  color: rgba(255,255,255,0.8) !important;
}
.VPNav.nav-at-top .DocSearch-Button-Placeholder {
  color: rgba(255,255,255,0.6) !important;
}
/* 首页滚动后：深色文字 */
.VPNav.nav-scrolled .VPNavBarMenuLink,
.VPNav.nav-scrolled .VPNavBarMenuLink span,
.VPNav.nav-scrolled .VPNavBarMenu a,
.VPNav.nav-scrolled .VPNavBarMenu button,
.VPNav.nav-scrolled .VPNavBarMenuGroup button,
.VPNav.nav-scrolled .VPNavBarTitle,
.VPNav.nav-scrolled .VPNavBarTitle span,
.VPNav.nav-scrolled .title,
.VPNav.nav-scrolled .VPNavBarAppearance,
.VPNav.nav-scrolled .VPNavBarHamburger,
.VPNav.nav-scrolled .VPNavBarHamburger span {
  color: var(--vp-c-text-1) !important;
}
.VPNav.nav-scrolled .nav-rd,
.VPNav.nav-scrolled .nav-studio {
  color: var(--vp-c-text-1) !important;
}
.VPNav.nav-scrolled .DocSearch-Button {
  color: var(--vp-c-text-2) !important;
}

/* FAB 按钮样式 */
.fab-button {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: var(--vp-c-brand-1);
  color: white;
  border: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  transition: all 0.2s ease;
}

.fab-button:hover {
  background: var(--vp-c-brand-2);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
  transform: scale(1.05);
}

.fab-button:active {
  transform: scale(0.95);
}

.fab-icon {
  font-size: 1.5rem;
  font-weight: 300;
  line-height: 1;
}

@media (max-width: 768px) {
  .fab-button {
    width: 48px;
    height: 48px;
    bottom: 1rem;
    right: 1rem;
  }
  
  .fab-icon {
    font-size: 1.25rem;
  }
}

</style>
