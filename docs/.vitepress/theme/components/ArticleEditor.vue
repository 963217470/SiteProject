<template>
  <div class="editor-container">
    <div class="editor-header">
      <h1>发布文章</h1>
      <div class="editor-actions">
        <button class="btn-secondary" type="button" @click="goBack">返回列表</button>
        <button class="btn-primary" type="button" :disabled="submitting" @click="submitArticle">
          {{ submitting ? '提交中...' : '提交审核' }}
        </button>
      </div>
    </div>

    <div class="upload-section">
      <h3>上传 Markdown 文件</h3>
      <input ref="fileInput" type="file" accept=".md,.markdown,text/markdown,text/plain" @change="handleFileUpload" hidden>
      <button class="upload-btn" type="button" @click="triggerFileSelect">选择 Markdown 文件</button>
      <p v-if="selectedFile" class="selected-file">{{ selectedFile }}</p>
    </div>

    <div class="editor-form">
      <label class="form-group">
        <span>标题</span>
        <input v-model="article.title" type="text" placeholder="请输入文章标题">
      </label>

      <label class="form-group">
        <span>摘要</span>
        <textarea v-model="article.summary" placeholder="请输入文章摘要" rows="3"></textarea>
      </label>

      <label class="form-group">
        <span>标签</span>
        <input v-model="article.tagsInput" type="text" placeholder="Unity, 教程, 笔记">
      </label>

      <label class="form-group">
        <span>可见性</span>
        <select v-model="article.visibility">
          <option value="public">公开</option>
          <option value="internal">内部</option>
        </select>
      </label>

      <label class="form-group">
        <span>内容</span>
        <textarea v-model="article.content" placeholder="请输入文章内容" rows="20"></textarea>
      </label>
    </div>

    <div v-if="statusMessage" :class="['status-message', statusType]">
      {{ statusMessage }}
    </div>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'

const fileInput = ref(null)
const selectedFile = ref('')
const submitting = ref(false)
const statusMessage = ref('')
const statusType = ref('success')

const article = reactive({
  title: '',
  summary: '',
  tagsInput: '',
  visibility: 'public',
  content: ''
})

function goBack() {
  window.location.href = '/SiteProject/articles'
}

function triggerFileSelect() {
  fileInput.value?.click()
}

function parseFrontmatter(text) {
  const result = {}
  const lines = text.split('\n')

  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.+)$/)
    if (!match) continue

    const key = match[1].toLowerCase()
    const rawValue = match[2].trim().replace(/^["']|["']$/g, '')

    if (key === 'tags') {
      result.tags = rawValue
        .replace(/^\[|\]$/g, '')
        .split(',')
        .map(tag => tag.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
    } else {
      result[key] = rawValue
    }
  }

  return result
}

function handleFileUpload(event) {
  const file = event.target.files?.[0]
  if (!file) return

  selectedFile.value = file.name

  const reader = new FileReader()
  reader.onload = function(e) {
    const rawContent = String(e.target?.result || '')
    let content = rawContent
    const frontmatterMatch = rawContent.match(/^---\n([\s\S]*?)\n---\n/)

    if (frontmatterMatch) {
      const frontmatter = parseFrontmatter(frontmatterMatch[1])
      if (frontmatter.title) article.title = frontmatter.title
      if (frontmatter.summary) article.summary = frontmatter.summary
      if (frontmatter.visibility) article.visibility = frontmatter.visibility
      if (frontmatter.tags) article.tagsInput = frontmatter.tags.join(', ')
      content = rawContent.replace(/^---\n[\s\S]*?\n---\n/, '')
    }

    if (!article.title.trim()) {
      const firstHeading = content.match(/^#\s+(.+)$/m)
      if (firstHeading) {
        article.title = firstHeading[1].trim()
        content = content.replace(/^#\s+.+\n?/, '')
      }
    }

    article.content = content.trim()
    showStatus('文件读取成功', 'success')
  }
  reader.onerror = function() {
    showStatus('文件读取失败，请重新选择', 'error')
  }
  reader.readAsText(file)
}

async function waitForSupabase(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    if (typeof window !== 'undefined' && window.__supabase) return window.__supabase
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  return null
}

async function submitArticle() {
  if (submitting.value) return

  if (!article.title.trim()) {
    showStatus('请输入标题', 'error')
    return
  }

  if (!article.content.trim()) {
    showStatus('请输入内容', 'error')
    return
  }

  submitting.value = true
  showStatus('正在提交...', 'info')

  try {
    const supabase = await waitForSupabase()
    if (!supabase) {
      showStatus('Supabase 未加载，请刷新页面后重试', 'error')
      return
    }

    const { data: sessionResult } = await supabase.auth.getSession()
    const userId = sessionResult?.session?.user?.id || null
    const tags = article.tagsInput.split(',').map(tag => tag.trim()).filter(Boolean)

    const articleData = {
      title: article.title.trim(),
      summary: article.summary.trim(),
      content: article.content,
      tags,
      visibility: article.visibility,
      status: 'pending',
      author_id: userId
    }

    const { data, error } = await supabase
      .from('articles')
      .insert(articleData)
      .select('id')
      .single()

    if (error) {
      showStatus('提交失败：' + error.message, 'error')
      return
    }

    const insertedArticle = Array.isArray(data) ? data[0] : data

    if (!insertedArticle?.id) {
      showStatus('提交失败：数据库没有返回文章 ID', 'error')
      return
    }

    showStatus('提交成功，文章已进入待审核', 'success')
    setTimeout(() => {
      window.location.href = '/SiteProject/admin'
    }, 1200)
  } catch (e) {
    showStatus('提交失败：' + (e?.message || '未知错误'), 'error')
  } finally {
    submitting.value = false
  }
}

function showStatus(message, type) {
  statusMessage.value = message
  statusType.value = type
}
</script>

<style scoped>
.editor-container {
  max-width: 860px;
  margin: 0 auto;
  padding: 2rem;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--vp-c-divider);
}

.editor-header h1 {
  margin: 0;
}

.editor-actions {
  display: flex;
  gap: 0.75rem;
}

.btn-primary,
.btn-secondary,
.upload-btn {
  padding: 0.55rem 1rem;
  border: 1px solid transparent;
  border-radius: 6px;
  cursor: pointer;
  font-size: 0.95rem;
}

.btn-primary,
.upload-btn {
  background: var(--vp-c-brand-1);
  color: white;
}

.btn-primary:disabled {
  cursor: not-allowed;
  opacity: 0.65;
}

.btn-secondary {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
  border-color: var(--vp-c-divider);
}

.upload-section {
  margin-bottom: 2rem;
  padding: 1.25rem;
  border: 1px dashed var(--vp-c-divider);
  border-radius: 8px;
  text-align: center;
}

.upload-section h3 {
  margin-top: 0;
}

.selected-file {
  margin: 0.75rem 0 0;
  color: var(--vp-c-text-2);
}

.editor-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  font-weight: 600;
}

.form-group input,
.form-group textarea,
.form-group select {
  padding: 0.75rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font: inherit;
  resize: vertical;
}

.form-group input:focus,
.form-group textarea:focus,
.form-group select:focus {
  outline: none;
  border-color: var(--vp-c-brand-1);
}

.status-message {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 6px;
}

.status-message.success {
  background: #dcfce7;
  color: #166534;
}

.status-message.error {
  background: #fee2e2;
  color: #991b1b;
}

.status-message.info {
  background: #dbeafe;
  color: #1e40af;
}

@media (max-width: 640px) {
  .editor-container {
    padding: 1rem;
  }

  .editor-header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
