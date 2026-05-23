<template>
  <div class="editor-shell">
    <header class="editor-topbar">
      <div>
        <p class="eyebrow">在线编辑系统</p>
        <h1>编辑文章</h1>
      </div>
      <div class="editor-actions">
        <button class="btn secondary" type="button" @click="goBack">返回列表</button>
        <button class="btn secondary" type="button" :disabled="submitting" @click="saveDraft">保存草稿</button>
        <button class="btn primary" type="button" :disabled="submitting" @click="submitArticle">
          {{ submitting ? '提交中...' : '提交审核' }}
        </button>
      </div>
    </header>

    <section class="editor-meta">
      <label class="title-field">
        <span>标题</span>
        <input v-model="article.title" type="text" placeholder="Unity 2D 光照系统入门指南">
      </label>

      <div class="tag-row">
        <span class="field-label">标签</span>
        <div class="tag-editor">
          <button
            v-for="tag in presetTags"
            :key="tag"
            type="button"
            :class="['tag-chip', { active: selectedTags.includes(tag) }]"
            @click="toggleTag(tag)"
          >
            {{ tag }}
          </button>
          <input v-model="customTag" type="text" placeholder="+ 添加标签" @keydown.enter.prevent="addCustomTag">
        </div>
      </div>

      <div class="visibility-row">
        <span class="field-label">可见性</span>
        <label class="radio-pill">
          <input v-model="article.visibility" type="radio" value="public">
          <span>公开</span>
        </label>
        <label class="radio-pill">
          <input v-model="article.visibility" type="radio" value="internal">
          <span>内部成员</span>
        </label>
      </div>
    </section>

    <section class="import-panel">
      <input ref="fileInput" type="file" accept=".md,.markdown,text/markdown,text/plain" @change="handleFileUpload" hidden>
      <input ref="folderInput" type="file" webkitdirectory directory multiple @change="handleFolderUpload" hidden>
      <input ref="imageInput" type="file" accept="image/*" @change="handleImageUpload" hidden>

      <button class="import-tile" type="button" @click="triggerFileSelect">
        <strong>上传 Markdown 文件</strong>
        <span>{{ selectedFile || '读取标题、标签、可见性和正文' }}</span>
      </button>
      <button class="import-tile" type="button" @click="triggerFolderSelect">
        <strong>上传文章文件夹</strong>
        <span>{{ selectedFolder || '支持 .md + 相对路径图片' }}</span>
      </button>
      <button class="import-tile" type="button" @click="triggerImageSelect">
        <strong>插入图片</strong>
        <span>拖拽或选择图片插入正文</span>
      </button>
    </section>

    <section class="body-panel" @dragover.prevent @drop.prevent="handleDrop">
      <div class="body-header">
        <span>正文</span>
        <div class="block-toolbar">
          <button type="button" @click="insertBlock('h2')">H2</button>
          <button type="button" @click="insertBlock('h3')">H3</button>
          <button type="button" @click="insertBlock('quote')">引用</button>
          <button type="button" @click="insertBlock('code')">代码</button>
          <button type="button" @click="insertBlock('ul')">列表</button>
          <button type="button" @click="insertBlock('hr')">分割线</button>
        </div>
      </div>

      <div class="editor-workspace">
        <textarea
          ref="contentInput"
          v-model="article.content"
          class="content-editor"
          placeholder="直接输入正文，或上传 Markdown / 文件夹。支持拖拽图片到这里。"
          rows="20"
        ></textarea>
        <aside class="content-preview" aria-label="正文预览">
          <div class="preview-title">预览</div>
          <div v-if="article.content.trim()" class="preview-body" v-html="previewHtml"></div>
          <div v-else class="preview-empty">上传或输入内容后，这里会显示图片和排版效果。</div>
        </aside>
      </div>
    </section>

    <label class="summary-field">
      <span>摘要</span>
      <textarea v-model="article.summary" rows="3" placeholder="留空时会自动使用正文前 120 字"></textarea>
    </label>

    <div v-if="statusMessage" :class="['status-message', statusType]">
      {{ statusMessage }}
    </div>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'

const fileInput = ref(null)
const folderInput = ref(null)
const imageInput = ref(null)
const contentInput = ref(null)
const selectedFile = ref('')
const selectedFolder = ref('')
const submitting = ref(false)
const statusMessage = ref('')
const statusType = ref('success')
const customTag = ref('')

const presetTags = ['Unity', 'Godot', 'Unreal Engine', 'C#', '教程', '入门', '进阶', '2D游戏', '3D游戏', '团队合作']
const selectedTags = ref([])

const article = reactive({
  title: '',
  summary: '',
  visibility: 'public',
  content: ''
})

const tags = computed(() => selectedTags.value)
const previewHtml = computed(() => renderMarkdownPreview(article.content))

function goBack() {
  window.location.href = '/SiteProject/articles'
}

function triggerFileSelect() {
  fileInput.value?.click()
}

function triggerFolderSelect() {
  folderInput.value?.click()
}

function triggerImageSelect() {
  imageInput.value?.click()
}

function toggleTag(tag) {
  selectedTags.value = selectedTags.value.includes(tag)
    ? selectedTags.value.filter(item => item !== tag)
    : selectedTags.value.concat(tag)
}

function addCustomTag() {
  const tag = customTag.value.trim()
  if (!tag) return
  if (!selectedTags.value.includes(tag)) selectedTags.value.push(tag)
  customTag.value = ''
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function renderMarkdownPreview(content) {
  const html = escapeHtml(content)
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+|data:image\/[^)]+)\)/g, '<figure class="preview-image"><img src="$2" alt="$1"><figcaption>$1</figcaption></figure>')
    .replace(/^### (.*)$/gim, '<h3>$1</h3>')
    .replace(/^## (.*)$/gim, '<h2>$1</h2>')
    .replace(/^# (.*)$/gim, '<h1>$1</h1>')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\n\n+/g, '</p><p>')
    .replace(/\n/g, '<br>')

  return '<p>' + html + '</p>'
}

function parseFrontmatter(text) {
  const result = {}
  const match = text.match(/^---\n([\s\S]*?)\n---\n?/)
  if (!match) return { data: result, content: text }

  for (const line of match[1].split('\n')) {
    const item = line.match(/^([\w-]+):\s*(.+)$/)
    if (!item) continue
    const key = item[1].toLowerCase()
    const rawValue = item[2].trim().replace(/^["']|["']$/g, '')

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

  return { data: result, content: text.replace(/^---\n[\s\S]*?\n---\n?/, '') }
}

function applyImportedMarkdown(text, sourceName) {
  const parsed = parseFrontmatter(text)
  const frontmatter = parsed.data
  let content = parsed.content

  if (frontmatter.title) article.title = frontmatter.title
  if (frontmatter.summary) article.summary = frontmatter.summary
  if (frontmatter.visibility) article.visibility = frontmatter.visibility
  if (frontmatter.tags) selectedTags.value = frontmatter.tags

  if (!article.title.trim()) {
    const firstHeading = content.match(/^#\s+(.+)$/m)
    if (firstHeading) {
      article.title = firstHeading[1].trim()
      content = content.replace(/^#\s+.+\n?/, '')
    } else if (sourceName) {
      article.title = sourceName.replace(/\.(md|markdown|txt)$/i, '')
    }
  }

  article.content = content.trim()
}

async function readFileAsText(file) {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(buffer)
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder('utf-16be').decode(buffer)
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return new TextDecoder('utf-8').decode(buffer)

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer)
  } catch (error) {
    try {
      return new TextDecoder('gb18030').decode(buffer)
    } catch (fallbackError) {
      throw new Error('文件编码无法识别，请将 Markdown 保存为 UTF-8 后重试')
    }
  }
}

function dataUrlToFile(dataUrl, name) {
  const parts = String(dataUrl || '').match(/^data:([^;]+);base64,(.+)$/)
  if (!parts) throw new Error('图片数据格式不正确')
  const mime = parts[1]
  const binary = atob(parts[2])
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  const ext = (mime.split('/')[1] || 'jpg').replace('jpeg', 'jpg')
  return new File([bytes], name + '.' + ext, { type: mime })
}

async function replaceInlineDataImages(markdown) {
  if (!/!\[[^\]]*\]\(data:image\//i.test(markdown)) return markdown
  const supabase = await waitForSupabase()
  if (!supabase) throw new Error('Supabase 未加载，请刷新页面后重试')

  const matches = Array.from(markdown.matchAll(/!\[([^\]]*)\]\((data:image\/[^)]+)\)/g))
  let next = markdown
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const alt = match[1] || 'image-' + (i + 1)
    const file = dataUrlToFile(match[2], alt.replace(/[^\w.-]+/g, '-').slice(0, 40) || 'image')
    const imageUrl = await uploadArticleImage(supabase, file)
    next = next.replace(match[0], '![' + alt + '](' + imageUrl + ')')
  }
  return next
}

async function handleFileUpload(event) {
  const file = event.target.files?.[0]
  if (!file) return

  try {
    selectedFile.value = file.name
    let markdown = await readFileAsText(file)
    if (/!\[[^\]]*\]\(data:image\//i.test(markdown)) {
      showStatus('正在上传 Markdown 内嵌图片...', 'info')
      markdown = await replaceInlineDataImages(markdown)
    }
    applyImportedMarkdown(markdown, file.name)
    showStatus('Markdown 文件读取成功', 'success')
  } catch (error) {
    showStatus(error.message || '文件读取失败，请重新选择', 'error')
  } finally {
    event.target.value = ''
  }
}

async function handleFolderUpload(event) {
  const files = Array.from(event.target.files || [])
  if (files.length === 0) return

  try {
    const markdownFile = files.find(file => /\.(md|markdown)$/i.test(file.name))
    if (!markdownFile) {
      showStatus('文件夹中没有找到 Markdown 文件', 'error')
      return
    }

    selectedFolder.value = markdownFile.webkitRelativePath.split('/')[0] || '已选择文件夹'
    showStatus('正在上传文件夹中的图片...', 'info')
    const supabase = await waitForSupabase()
    if (!supabase) throw new Error('Supabase 未加载，请刷新页面后重试')

    const imageMap = new Map()

    for (const file of files) {
      if (!file.type.startsWith('image/')) continue
      const imageUrl = await uploadArticleImage(supabase, file)
      const fullPath = normalizePath(file.webkitRelativePath)
      const relativePath = fullPath.split('/').slice(1).join('/')
      imageMap.set(fullPath, imageUrl)
      imageMap.set(relativePath, imageUrl)
      imageMap.set(normalizePath(file.name), imageUrl)
    }

    let markdown = await readFileAsText(markdownFile)
    const baseDir = normalizePath(markdownFile.webkitRelativePath).split('/').slice(0, -1).join('/')
    markdown = replaceRelativeImages(markdown, baseDir, imageMap)

    applyImportedMarkdown(markdown, markdownFile.name)
    showStatus('文件夹读取成功，图片已上传并插入正文', 'success')
  } catch (error) {
    showStatus(error.message || '文件夹读取失败，请重新选择', 'error')
  } finally {
    event.target.value = ''
  }
}

function normalizePath(path) {
  return String(path || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\/+/g, '/')
}

function isImagePath(path) {
  return /\.(png|jpe?g|gif|webp|svg)([?#].*)?$/i.test(normalizePath(path))
}

function imageAltFromPath(path) {
  const name = normalizePath(path).split('/').pop() || 'image'
  return name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'image'
}

function safeFileName(name) {
  const ext = (String(name || '').split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const base = String(name || 'image')
    .replace(/\.[^.]+$/, '')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'image'
  return base + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext
}

async function uploadArticleImage(supabase, file) {
  const sessionResult = await supabase.auth.getSession()
  const userId = sessionResult?.data?.session?.user?.id || 'anonymous'
  const path = 'article-images/' + userId + '/' + safeFileName(file.name)
  const upload = await supabase.storage.from('avatars').upload(path, file)
  if (upload.error) throw new Error('图片上传失败：' + upload.error.message)
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}

function findImageUrl(src, baseDir, imageMap) {
  if (/^(https?:|data:|\/)/i.test(src)) return ''
  const normalizedSrc = normalizePath(src).replace(/[?#].*$/, '')
  const withBase = normalizePath((baseDir ? baseDir + '/' : '') + normalizedSrc)
  const fileName = normalizedSrc.split('/').pop()
  if (imageMap.get(withBase)) return imageMap.get(withBase)
  if (imageMap.get(normalizedSrc)) return imageMap.get(normalizedSrc)
  if (imageMap.get(fileName)) return imageMap.get(fileName)

  for (const [key, value] of imageMap.entries()) {
    if (key.endsWith('/' + normalizedSrc) || (fileName && key.endsWith('/' + fileName))) return value
  }
  return ''
}

function replaceRelativeImages(markdown, baseDir, imageMap) {
  return markdown
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, function(match, alt, src) {
      const imageUrl = findImageUrl(src, baseDir, imageMap)
      return imageUrl ? '![' + (alt || imageAltFromPath(src)) + '](' + imageUrl + ')' : match
    })
    .split('\n')
    .map(function(line) {
      const trimmed = line.trim()
      const brokenImage = trimmed.match(/^!\[([^\]\n]*)\]?[^()\n]*\(([^)\n]+\.(?:png|jpe?g|gif|webp|svg)(?:[?#][^)]+)?)\)\s*$/i)
      if (brokenImage) {
        const imageUrl = findImageUrl(brokenImage[2], baseDir, imageMap)
        return imageUrl ? '![' + (brokenImage[1] || imageAltFromPath(brokenImage[2])) + '](' + imageUrl + ')' : line
      }
      if (isImagePath(trimmed) && !/^\s*!\[/.test(line)) {
        const imageUrl = findImageUrl(trimmed, baseDir, imageMap)
        return imageUrl ? '![' + imageAltFromPath(trimmed) + '](' + imageUrl + ')' : line
      }
      return line
    })
    .join('\n')
}

async function handleImageUpload(event) {
  const file = event.target.files?.[0]
  if (!file) return
  await insertImageFile(file)
  event.target.value = ''
}

async function handleDrop(event) {
  const files = Array.from(event.dataTransfer?.files || [])
  const image = files.find(file => file.type.startsWith('image/'))
  if (image) await insertImageFile(image)
}

async function insertImageFile(file) {
  try {
    const supabase = await waitForSupabase()
    if (!supabase) throw new Error('Supabase 未加载，请刷新页面后重试')
    const imageUrl = await uploadArticleImage(supabase, file)
    insertAtCursor('\n\n![' + file.name.replace(/\.[^.]+$/, '') + '](' + imageUrl + ')\n\n')
    showStatus('图片已插入正文', 'success')
  } catch (error) {
    showStatus(error.message || '图片插入失败', 'error')
  }
}

function insertBlock(type) {
  const snippets = {
    h2: '\n\n## 小节标题\n\n',
    h3: '\n\n### 子标题\n\n',
    quote: '\n\n> 引用内容\n\n',
    code: '\n\n```js\n// code\n```\n\n',
    ul: '\n\n- 列表项\n- 列表项\n\n',
    hr: '\n\n---\n\n'
  }
  insertAtCursor(snippets[type] || '\n\n')
}

function insertAtCursor(text) {
  const textarea = contentInput.value
  if (!textarea) {
    article.content += text
    return
  }

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  article.content = article.content.slice(0, start) + text + article.content.slice(end)

  requestAnimationFrame(() => {
    textarea.focus()
    textarea.selectionStart = textarea.selectionEnd = start + text.length
  })
}

async function waitForSupabase(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    if (typeof window !== 'undefined' && window.__supabase) return window.__supabase
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  return null
}

async function saveDraft() {
  await saveArticle('draft')
}

async function submitArticle() {
  await saveArticle('pending')
}

async function saveArticle(status) {
  if (submitting.value) return

  addCustomTag()

  if (!article.title.trim()) {
    showStatus('请输入标题', 'error')
    return
  }

  if (!article.content.trim()) {
    showStatus('请输入内容', 'error')
    return
  }

  submitting.value = true
  showStatus(status === 'pending' ? '正在提交...' : '正在保存草稿...', 'info')

  try {
    const supabase = await waitForSupabase()
    if (!supabase) {
      showStatus('Supabase 未加载，请刷新页面后重试', 'error')
      return
    }

    const { data: sessionResult } = await supabase.auth.getSession()
    const userId = sessionResult?.session?.user?.id || null
    if (!userId) {
      showStatus('请先使用 GitHub 登录后再提交文章', 'error')
      return
    }

    if (/!\[[^\]]*\]\(data:image\//i.test(article.content)) {
      showStatus('正在将内嵌图片转为线上图片...', 'info')
      article.content = await replaceInlineDataImages(article.content)
    }

    const articleData = {
      title: article.title.trim(),
      summary: article.summary.trim() || buildSummary(article.content),
      content: article.content,
      tags: tags.value,
      visibility: article.visibility,
      status: status === 'draft' ? 'draft' : 'pending',
      author_id: userId
    }

    const { data, error } = await supabase
      .from('articles')
      .insert(articleData)
      .select('id')
      .single()

    if (error) {
      showStatus('保存失败：' + error.message, 'error')
      return
    }

    const insertedArticle = Array.isArray(data) ? data[0] : data

    if (!insertedArticle?.id) {
      showStatus('保存失败：数据库没有返回文章 ID', 'error')
      return
    }

    showStatus(status === 'pending' ? '提交成功，文章已进入待审核' : '草稿保存成功', 'success')
    if (status === 'pending') {
      setTimeout(() => {
        window.location.href = '/SiteProject/articles'
      }, 1200)
    }
  } catch (error) {
    showStatus('保存失败：' + (error?.message || '未知错误'), 'error')
  } finally {
    submitting.value = false
  }
}

function buildSummary(content) {
  return content
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/[#>*_`-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
}

function showStatus(message, type) {
  statusMessage.value = message
  statusType.value = type
}
</script>

<style scoped>
.editor-shell {
  max-width: 1040px;
  margin: 0 auto;
  padding: 2rem;
}

.editor-topbar {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  padding-bottom: 1rem;
  margin-bottom: 1.25rem;
  border-bottom: 1px solid var(--vp-c-divider);
}

.eyebrow {
  margin: 0 0 0.25rem;
  color: var(--vp-c-text-2);
  font-size: 0.85rem;
}

.editor-topbar h1 {
  margin: 0;
  font-size: 1.8rem;
}

.editor-actions,
.visibility-row,
.block-toolbar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.btn,
.block-toolbar button,
.import-tile,
.tag-chip {
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  cursor: pointer;
  font: inherit;
}

.btn {
  padding: 0.58rem 0.95rem;
}

.btn.primary {
  background: var(--vp-c-brand-1);
  border-color: var(--vp-c-brand-1);
  color: white;
}

.btn.secondary {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
}

.btn:disabled {
  cursor: not-allowed;
  opacity: 0.62;
}

.editor-meta,
.body-panel,
.summary-field {
  display: grid;
  gap: 1rem;
}

.editor-meta {
  margin-bottom: 1rem;
}

.title-field,
.summary-field {
  display: grid;
  gap: 0.45rem;
  font-weight: 600;
}

.title-field input,
.summary-field textarea,
.tag-editor input,
.content-editor {
  width: 100%;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font: inherit;
}

.title-field input {
  padding: 0.85rem 1rem;
  font-size: 1.25rem;
  font-weight: 650;
}

.summary-field textarea {
  padding: 0.8rem 1rem;
  resize: vertical;
}

.field-label {
  font-weight: 700;
  min-width: 4rem;
}

.tag-row,
.visibility-row {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
}

.tag-editor {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.tag-chip {
  padding: 0.38rem 0.68rem;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
}

.tag-chip.active {
  background: var(--vp-c-brand-soft);
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.tag-editor input {
  width: 9rem;
  padding: 0.42rem 0.65rem;
}

.radio-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.35rem 0.65rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg-soft);
}

.import-panel {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.75rem;
  margin: 1.25rem 0;
}

.import-tile {
  display: grid;
  gap: 0.25rem;
  padding: 1rem;
  text-align: left;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
}

.import-tile span {
  color: var(--vp-c-text-2);
  font-size: 0.85rem;
}

.body-panel {
  margin-bottom: 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
}

.body-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: var(--vp-c-bg-soft);
  font-weight: 700;
}

.block-toolbar button {
  min-width: 2.2rem;
  padding: 0.35rem 0.55rem;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}

.content-editor {
  min-height: 520px;
  padding: 1.2rem;
  border: 0;
  border-radius: 0;
  resize: vertical;
  line-height: 1.75;
}

.editor-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(280px, 42%);
  min-height: 520px;
}

.content-preview {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  border-left: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  min-width: 0;
}

.preview-title {
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-2);
  font-size: 0.86rem;
  font-weight: 700;
}

.preview-body {
  padding: 1.2rem;
  overflow: auto;
  color: var(--vp-c-text-1);
  font-size: 0.95rem;
  line-height: 1.85;
}

.preview-body h1,
.preview-body h2,
.preview-body h3 {
  margin: 1.1rem 0 0.55rem;
  line-height: 1.35;
}

.preview-body h1 {
  font-size: 1.35rem;
}

.preview-body h2 {
  font-size: 1.16rem;
}

.preview-body h3 {
  font-size: 1.02rem;
}

.preview-body code {
  padding: 0.12rem 0.32rem;
  border-radius: 4px;
  background: var(--vp-c-bg-soft);
}

.preview-image {
  margin: 1rem 0;
}

.preview-image img {
  display: block;
  width: 100%;
  max-height: 360px;
  object-fit: contain;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
}

.preview-image figcaption {
  margin-top: 0.42rem;
  color: var(--vp-c-text-2);
  font-size: 0.82rem;
  text-align: center;
}

.preview-image figcaption:empty {
  display: none;
}

.preview-empty {
  display: grid;
  place-items: center;
  padding: 2rem;
  color: var(--vp-c-text-2);
  text-align: center;
  font-size: 0.9rem;
}

.title-field input:focus,
.summary-field textarea:focus,
.tag-editor input:focus,
.content-editor:focus {
  outline: 2px solid var(--vp-c-brand-soft);
  border-color: var(--vp-c-brand-1);
}

.status-message {
  margin-top: 1rem;
  padding: 0.9rem 1rem;
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

@media (max-width: 760px) {
  .editor-shell {
    padding: 1rem;
  }

  .editor-topbar,
  .body-header {
    flex-direction: column;
    align-items: stretch;
  }

  .import-panel {
    grid-template-columns: 1fr;
  }

  .editor-workspace {
    grid-template-columns: 1fr;
  }

  .content-preview {
    border-left: 0;
    border-top: 1px solid var(--vp-c-divider);
    min-height: 320px;
  }

  .tag-row,
  .visibility-row {
    flex-direction: column;
  }
}
</style>
