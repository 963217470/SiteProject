<template>
  <div class="editor-container">
    <div class="editor-header">
      <h1>发布文章</h1>
      <div class="editor-actions">
        <button class="btn-secondary" @click="goBack">返回列表</button>
        <button class="btn-primary" @click="submitArticle">提交审核</button>
      </div>
    </div>

    <div class="upload-section">
      <h3>上传 Markdown 文件</h3>
      <input type="file" ref="fileInput" accept=".md" @change="handleFileUpload" style="display: none;">
      <button class="upload-btn" @click="triggerFileSelect">选择 Markdown 文件</button>
      <p v-if="selectedFile">{{ selectedFile }}</p>
    </div>

    <div class="editor-form">
      <div class="form-group">
        <label>标题</label>
        <input v-model="article.title" type="text" placeholder="请输入文章标题">
      </div>

      <div class="form-group">
        <label>摘要</label>
        <textarea v-model="article.summary" placeholder="请输入文章摘要" rows="3"></textarea>
      </div>

      <div class="form-group">
        <label>标签（用逗号分隔）</label>
        <input v-model="article.tagsInput" type="text" placeholder="标签1, 标签2, 标签3">
      </div>

      <div class="form-group">
        <label>内容</label>
        <textarea v-model="article.content" placeholder="请输入文章内容" rows="20"></textarea>
      </div>
    </div>

    <div v-if="statusMessage" :class="['status-message', statusType]">
      {{ statusMessage }}
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, watch } from 'vue'

const fileInput = ref(null)
const selectedFile = ref('')

const article = reactive({
  title: '',
  summary: '',
  tagsInput: '',
  content: ''
})

watch(() => article.title, (newVal) => {
  console.log('Title changed:', JSON.stringify(newVal))
})

const statusMessage = ref('')
const statusType = ref('success')

function goBack() {
  window.location.href = '/SiteProject/articles'
}

function triggerFileSelect() {
  fileInput.value?.click()
}

function handleFileUpload(event) {
  const file = event.target.files[0]
  if (!file) return

  selectedFile.value = file.name
  
  const reader = new FileReader()
  reader.onload = function(e) {
    const content = e.target.result
    let actualContent = content
    
    const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---\n/)
    if (frontmatterMatch) {
      const frontmatter = parseFrontmatter(frontmatterMatch[1])
      if (frontmatter.title) article.title = frontmatter.title
      if (frontmatter.summary) article.summary = frontmatter.summary
      if (frontmatter.tags) article.tagsInput = frontmatter.tags.join(', ')
      actualContent = content.replace(/^---\n[\s\S]*?\n---\n/, '')
    }
    
    article.content = actualContent
    
    if (!article.title.trim()) {
      const firstHeading = actualContent.match(/^#\s+(.+)$/m)
      if (firstHeading) {
        article.title = firstHeading[1].trim()
        article.content = actualContent.replace(/^#\s+.+\n/, '')
      }
    }
    
    console.log('After file upload - title:', article.title)
    console.log('After file upload - content length:', article.content.length)
    
    showStatus('文件读取成功！', 'success')
  }
  
  reader.readAsText(file)
}

function parseFrontmatter(text) {
  const result = {}
  const lines = text.split('\n')
  for (const line of lines) {
    const match = line.match(/^(\w+):\s*(.+)$/)
    if (match) {
      const key = match[1].toLowerCase()
      let value = match[2].trim()
      if (key === 'tags') {
        result[key] = value.split(',').map(t => t.trim()).filter(t => t)
      } else {
        result[key] = value.replace(/^["']|["']$/g, '')
      }
    }
  }
  return result
}

async function submitArticle() {
  console.log('submitArticle called')
  
  if (!article.title.trim()) {
    showStatus('请输入标题', 'error')
    return
  }
  if (!article.content.trim()) {
    showStatus('请输入内容', 'error')
    return
  }

  showStatus('正在提交...', 'info')

  try {
    const supabase = window.__supabase
    if (!supabase) {
      showStatus('Supabase 未加载', 'error')
      return
    }

    const tags = article.tagsInput.split(',').map(t => t.trim()).filter(t => t)

    const articleData = {
      title: article.title,
      summary: article.summary,
      content: article.content,
      tags: tags,
      visibility: 'public',
      status: 'pending',
      author_id: null
    }

    const result = await supabase.from('articles').insert([articleData])
    
    if (result.error) {
      console.log('Error:', result.error)
      if (result.error.message.includes('row-level security policy')) {
        showStatus('提交失败: 需要登录后才能提交文章', 'error')
      } else {
        showStatus('提交失败: ' + result.error.message, 'error')
      }
    } else {
      showStatus('提交成功！', 'success')
      setTimeout(() => {
        window.location.href = '/SiteProject/articles'
      }, 1500)
    }
  } catch (e) {
    console.error('Exception:', e)
    showStatus('提交失败: ' + e.message, 'error')
  }
}

function showStatus(message, type) {
  statusMessage.value = message
  statusType.value = type
  
  if (type === 'success') {
    setTimeout(() => {
      statusMessage.value = ''
    }, 3000)
  }
}
</script>

<style scoped>
.editor-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid #eee;
}

.editor-header h1 {
  margin: 0;
}

.editor-actions {
  display: flex;
  gap: 0.75rem;
}

.btn-primary, .btn-secondary {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.btn-primary {
  background: #8B0000;
  color: white;
}

.btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.upload-section {
  margin-bottom: 2rem;
  padding: 1.5rem;
  border: 2px dashed #ddd;
  border-radius: 8px;
  text-align: center;
}

.upload-section h3 {
  margin-top: 0;
}

.upload-btn {
  display: inline-block;
  padding: 0.5rem 1.5rem;
  background: #8B0000;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin: 0.5rem 0;
}

.editor-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  font-weight: 500;
  margin-bottom: 0.5rem;
}

.form-group input,
.form-group textarea {
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  resize: vertical;
}

.form-group textarea:focus,
.form-group input:focus {
  outline: none;
  border-color: #8B0000;
}

.status-message {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 4px;
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
</style>
