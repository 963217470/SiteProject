---
title: API 测试
layout: page
---

<script setup>
import { ref } from 'vue'
const status = ref('')
async function testApi() {
  status.value = '检查中…'
  try {
    const { error } = await window.__supabase.from('articles').select('id').limit(0)
    status.value = error ? '连接失败：' + error.message : '连接成功（只读检查）'
  } catch (error) {
    status.value = '连接失败：' + error.message
  }
}
</script>

# API 测试

<button @click="testApi">检查数据库连接</button>
<p>{{ status }}</p>
