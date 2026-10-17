<template>
  <Teleport v-if="active" to="#panel-mcp">
    <div class="panel-head"><h2>AI / MCP 接入</h2><a href="/user/mcp/">完整接入指南</a></div>
    <McpUploadTokens />
    <p><a href="/mcp/rd-studio-mcp.zip">下载 MCP 配置包</a></p>
  </Teleport>
</template>

<script setup>
import { onMounted, onUnmounted, ref } from 'vue'
import McpUploadTokens from './McpUploadTokens.vue'
const active = ref(false)
function update() {
  const panel = document.getElementById('panel-mcp')
  active.value = Boolean(panel && panel.style.display !== 'none' && document.getElementById('profile-app')?.style.display !== 'none')
}
onMounted(() => { window.addEventListener('rd:profile-tab', update); update() })
onUnmounted(() => window.removeEventListener('rd:profile-tab', update))
</script>
