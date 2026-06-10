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
      <div class="visibility-row featured-visibility">
        <span class="field-label">可见性</span>
        <label class="radio-pill">
          <input v-model="article.visibility" type="radio" value="public" @change="syncVisibilityMode">
          <span>公开</span>
        </label>
        <label class="radio-pill">
          <input v-model="article.visibility" type="radio" value="internal" @change="syncVisibilityMode">
          <span>内部成员</span>
        </label>
        <small>{{ article.visibility === 'internal' ? '内部文章不会投入知识库，可上传附件供成员下载。' : '公开文章可选择投入知识库。' }}</small>
      </div>

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

      <div v-if="article.visibility !== 'internal'" class="knowledge-row">
        <label class="kb-toggle">
          <input v-model="article.kbEnabled" type="checkbox">
          <span>投入知识库</span>
        </label>
        <div class="kb-targets">
          <select v-model="article.kbBranchId" :disabled="!article.kbEnabled || !!article.kbBranchPath.trim() || kbLoading || kbBranches.length === 0">
            <option value="">选择已有分支</option>
            <option v-for="branch in flatBranches" :key="branch.id" :value="branch.id">
              {{ branch.label }}
            </option>
          </select>
          <input
            v-model="article.kbBranchPath"
            :disabled="!article.kbEnabled || !!article.kbBranchId"
            type="text"
            placeholder="申请新分支：知识库总览/02-方向学习/程序/蓝图/基础操作/移动"
          >
        </div>
        <small v-if="kbError">{{ kbError }}</small>
        <small v-else>可以选择已有分支，也可以输入新分支路径。新分支需要管理员审核后才会生效。</small>
      </div>
    </section>

    <section class="import-panel">
      <input ref="fileInput" type="file" accept=".md,.markdown,text/markdown,text/plain" @change="handleFileUpload" hidden>
      <input ref="folderInput" type="file" webkitdirectory directory multiple @change="handleFolderUpload" hidden>
      <input ref="imageInput" type="file" accept="image/*" @change="handleImageUpload" hidden>
      <input ref="attachmentInput" type="file" @change="handleAttachmentUpload" hidden>

      <div class="import-tile">
        <button class="import-action" type="button" @click="triggerFileSelect">
          <strong>上传 Markdown 文件</strong>
          <span>{{ selectedFile || '读取标题、标签、可见性和正文' }}</span>
        </button>
        <button v-if="selectedFile" class="clear-upload" type="button" title="取消文件" aria-label="取消文件" @click="clearUpload('file')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.4 5 12.6 12.6-1.4 1.4L5 6.4 6.4 5Zm12.6 1.4L6.4 19 5 17.6 17.6 5 19 6.4Z"></path></svg>
        </button>
      </div>
      <div class="import-tile">
        <button class="import-action" type="button" @click="triggerFolderSelect">
          <strong>上传文章文件夹</strong>
          <span>{{ selectedFolder || '支持 .md + 相对路径图片' }}</span>
        </button>
        <button v-if="selectedFolder" class="clear-upload" type="button" title="取消文件夹" aria-label="取消文件夹" @click="clearUpload('folder')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.4 5 12.6 12.6-1.4 1.4L5 6.4 6.4 5Zm12.6 1.4L6.4 19 5 17.6 17.6 5 19 6.4Z"></path></svg>
        </button>
      </div>
      <div class="import-tile">
        <button class="import-action" type="button" @click="triggerImageSelect">
          <strong>插入图片</strong>
          <span>拖拽或选择图片插入正文</span>
        </button>
      </div>
      <div v-if="article.visibility === 'internal'" class="import-tile attachment-tile">
        <button class="import-action" type="button" @click="triggerAttachmentSelect">
          <strong>上传附件</strong>
          <span>{{ selectedAttachment || '压缩包、安装包、PDF、工程文件等' }}</span>
        </button>
        <button v-if="selectedAttachment" class="clear-upload" type="button" title="取消附件" aria-label="取消附件" @click="clearUpload('attachment')">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.4 5 12.6 12.6-1.4 1.4L5 6.4 6.4 5Zm12.6 1.4L6.4 19 5 17.6 17.6 5 19 6.4Z"></path></svg>
        </button>
      </div>
    </section>

    <section class="body-panel" @dragover.prevent @drop.prevent="handleDrop">
      <div class="body-header">
        <div class="block-toolbar" aria-label="正文排版工具">
          <button
            v-for="tool in formatTools"
            :key="tool.type"
            class="tool-button"
            type="button"
            :title="tool.label"
            :aria-label="tool.label"
            @click="insertBlock(tool.type)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path :d="tool.icon"></path>
            </svg>
          </button>
          <span class="toolbar-divider" aria-hidden="true"></span>
          <button
            v-for="color in colorTools"
            :key="color.value"
            class="color-button"
            type="button"
            :title="color.label"
            :aria-label="color.label"
            :style="{ '--swatch': color.value }"
            @click="applyColor(color.value)"
          ></button>
        </div>
      </div>

      <div class="editor-workspace">
        <textarea
          v-show="false"
          ref="contentInput"
          v-model="article.content"
          class="content-editor source-buffer"
          aria-hidden="true"
          tabindex="-1"
          placeholder="直接输入正文，或上传 Markdown / 文件夹。支持拖拽图片到这里。"
          rows="20"
        ></textarea>
        <div class="content-preview" aria-label="正文预览">
          <div
            ref="previewInput"
            class="preview-body editable-preview"
            contenteditable="true"
            spellcheck="true"
            data-placeholder="上传或输入内容后，这里会显示图片和排版效果。"
            @blur="syncPreviewEdit"
            @paste="handlePreviewPaste"
            v-html="previewHtml"
          ></div>
        </div>
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
import { computed, onMounted, reactive, ref } from 'vue'
import MarkdownIt from 'markdown-it'
import katexPlugin from '@vscode/markdown-it-katex'

const md = new MarkdownIt({ html: true, linkify: true, typographer: true })
md.use(katexPlugin.default || katexPlugin, { throwOnError: false })

const fileInput = ref(null)
const folderInput = ref(null)
const imageInput = ref(null)
const attachmentInput = ref(null)
const contentInput = ref(null)
const previewInput = ref(null)
const selectedFile = ref('')
const selectedFolder = ref('')
const selectedAttachment = ref('')
const submitting = ref(false)
const statusMessage = ref('')
const statusType = ref('success')
const customTag = ref('')
const kbBranches = ref([])
const kbLoading = ref(false)
const kbError = ref('')

const presetTags = ['Unity', 'Godot', 'Unreal Engine', 'C#', '教程', '入门', '进阶', '2D游戏', '3D游戏', '团队合作']
const selectedTags = ref([])
const formatTools = [
  { type: 'h2', label: '二级标题', icon: 'M4 5h2v6h8V5h2v14h-2v-6H6v6H4V5Zm14 4h-3V7h8v2h-3v10h-2V9Z' },
  { type: 'h3', label: '三级标题', icon: 'M4 5h2v6h7V5h2v14h-2v-6H6v6H4V5Zm13 4.5c.2-.8 1-1.5 2.2-1.5 1.6 0 2.8 1 2.8 2.4 0 .9-.5 1.7-1.4 2.1 1 .4 1.7 1.2 1.7 2.5 0 1.7-1.4 3-3.4 3-1.7 0-3-.9-3.4-2.3l1.8-.6c.2.7.8 1.1 1.6 1.1.9 0 1.4-.5 1.4-1.2 0-.8-.6-1.2-1.6-1.2h-1v-1.7h.9c.9 0 1.4-.5 1.4-1.1 0-.7-.5-1.1-1.2-1.1-.7 0-1.1.3-1.3.9l-1.8-.3Z' },
  { type: 'bold', label: '加粗', icon: 'M7 4h6.2c2.4 0 4 1.4 4 3.5 0 1.3-.6 2.4-1.7 3 1.5.5 2.4 1.8 2.4 3.5 0 2.4-1.8 4-4.6 4H7V4Zm3 5.8h2.8c.9 0 1.4-.5 1.4-1.3s-.5-1.3-1.4-1.3H10v2.6Zm0 5h3.1c1.1 0 1.7-.5 1.7-1.5s-.6-1.5-1.7-1.5H10v3Z' },
  { type: 'italic', label: '斜体', icon: 'M10 4h8v2h-3l-3 12h3v2H7v-2h3l3-12h-3V4Z' },
  { type: 'quote', label: '引用', icon: 'M7 7h5v5H9c0 2 1 3.3 3 4v2c-3.4-.8-5-3.1-5-6.8V7Zm8 0h5v5h-3c0 2 1 3.3 3 4v2c-3.4-.8-5-3.1-5-6.8V7Z' },
  { type: 'code', label: '代码块', icon: 'M8.7 16.6 3.9 12l4.8-4.6 1.4 1.5L6.9 12l3.2 3.1-1.4 1.5Zm6.6 0-1.4-1.5 3.2-3.1-3.2-3.1 1.4-1.5 4.8 4.6-4.8 4.6ZM11.2 19l-1.9-.6L12.8 5l1.9.6L11.2 19Z' },
  { type: 'ul', label: '无序列表', icon: 'M5 7.5A1.5 1.5 0 1 1 5 4a1.5 1.5 0 0 1 0 3.5ZM8 5h12v2H8V5Zm-3 8.5A1.5 1.5 0 1 1 5 10a1.5 1.5 0 0 1 0 3.5ZM8 11h12v2H8v-2Zm-3 8.5A1.5 1.5 0 1 1 5 16a1.5 1.5 0 0 1 0 3.5ZM8 17h12v2H8v-2Z' },
  { type: 'ol', label: '有序列表', icon: 'M4 5h2v5H4V8h1V6H4V5Zm0 7h2v1.5H5v1h1v1.5H4V14h1v-.5H4V12Zm0 6h2v1H5v.5h1V21H4v-1h1v-.5H4V18Zm5-12h11v2H9V6Zm0 6h11v2H9v-2Zm0 6h11v2H9v-2Z' },
  { type: 'link', label: '链接', icon: 'M10.6 13.4a1 1 0 0 1 0-1.4l3.4-3.4a3 3 0 0 1 4.2 4.2l-1.4 1.4-1.4-1.4 1.4-1.4a1 1 0 0 0-1.4-1.4L12 13.4a1 1 0 0 1-1.4 0Zm2.8-2.8a1 1 0 0 1 0 1.4L10 15.4a1 1 0 0 0 1.4 1.4l1.4-1.4 1.4 1.4-1.4 1.4a3 3 0 0 1-4.2-4.2l3.4-3.4a1 1 0 0 1 1.4 0Z' },
  { type: 'image', label: '插入图片', icon: 'M5 5h14v14H5V5Zm2 2v8.6l3.1-3.1 2.3 2.3 2.9-3.6L17 13.3V7H7Zm2.5 4A1.5 1.5 0 1 0 9.5 8a1.5 1.5 0 0 0 0 3Z' },
  { type: 'hr', label: '分割线', icon: 'M4 11h16v2H4v-2Z' }
]
const colorTools = [
  { label: '蓝色文字', value: '#61afef' },
  { label: '绿色文字', value: '#98c379' },
  { label: '橙色文字', value: '#d19a66' },
  { label: '紫色文字', value: '#c678dd' },
  { label: '红色文字', value: '#d81e06' }
]

const article = reactive({
  title: '',
  summary: '',
  visibility: 'public',
  content: '',
  kbEnabled: false,
  kbBranchId: '',
  kbBranchPath: ''
})

const tags = computed(() => selectedTags.value)
const previewHtml = computed(() => renderMarkdownPreview(article.content))
const flatBranches = computed(() => flattenBranches(kbBranches.value))

onMounted(loadKnowledgeBranches)

function goBack() {
  window.location.href = '/articles'
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

function triggerAttachmentSelect() {
  attachmentInput.value?.click()
}

function clearUpload(type) {
  if (type === 'file') {
    selectedFile.value = ''
    if (fileInput.value) fileInput.value.value = ''
    showStatus('已取消 Markdown 文件选择，当前正文已保留', 'info')
    return
  }

  if (type === 'folder') {
    selectedFolder.value = ''
    if (folderInput.value) folderInput.value.value = ''
    showStatus('已取消文件夹选择，当前正文已保留', 'info')
    return
  }

  if (type === 'attachment') {
    if (selectedAttachment.value) {
      article.content = article.content
        .split('\n')
        .filter(line => !line.includes('](') || !line.includes(selectedAttachment.value))
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim()
    }
    selectedAttachment.value = ''
    if (attachmentInput.value) attachmentInput.value.value = ''
    showStatus('已取消附件并从正文移除下载链接', 'info')
  }
}

function syncVisibilityMode() {
  if (article.visibility !== 'internal') return
  article.kbEnabled = false
  article.kbBranchId = ''
  article.kbBranchPath = ''
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

function flattenBranches(branches, parentId = null, depth = 0) {
  return branches
    .filter(branch => (branch.parent_id || null) === parentId)
    .sort((a, b) => (Number(a.sort_order || 0) - Number(b.sort_order || 0)) || String(a.name || '').localeCompare(String(b.name || ''), 'zh-CN'))
    .flatMap(branch => {
      const prefix = depth > 0 ? '　'.repeat(depth) + '└ ' : ''
      return [
        { ...branch, label: prefix + branch.name },
        ...flattenBranches(branches, branch.id, depth + 1)
      ]
    })
}

function normalizeBranchPath(value) {
  return String(value || '')
    .split('/')
    .map(part => part.trim())
    .filter(Boolean)
    .filter(part => part !== '知识库总览')
    .join('/')
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
  let html = md.render(String(content || ''))
  html = html
    .replace(/!\[([^\]]*)\]\((https?:\/\/[^)\s]+|data:image\/[^)]+)\)/g, function(match, alt, src) {
      return '<figure class="preview-image"><img src="' + src + '" alt="' + escapeHtml(alt) + '"><figcaption>' + escapeHtml(alt) + '</figcaption></figure>'
    })
    .replace(/\[\[#([^|\]]+)(?:\|([^\]]+))?\]\]/g, function(_, tag, label) {
      const cleanTag = String(tag || '').trim()
      const text = String(label || cleanTag).trim().replace(/^#/, '')
      return '<a class="wiki-tag" href="/articles?tag=' + encodeURIComponent(cleanTag) + '">#' + text + '</a>'
    })
    .replace(/\[\[([^#|\]]+)(?:\|([^\]]+))?\]\]/g, function(_, title, label) {
      const cleanTitle = String(title || '').trim()
      const text = String(label || cleanTitle).trim()
      return '<a class="wiki-link" href="/kb?branch=' + encodeURIComponent(cleanTitle) + '">' + text + '</a>'
    })
  return html
}

function syncPreviewEdit(event) {
  const target = event.currentTarget
  if (!target) return
  const markdown = domChildrenToMarkdown(target).trim()
  if (markdown !== article.content.trim()) article.content = markdown
}

function handlePreviewPaste(event) {
  const text = event.clipboardData?.getData('text/plain')
  if (!text) return
  event.preventDefault()
  document.execCommand('insertText', false, text)
}

function domChildrenToMarkdown(node) {
  return Array.from(node.childNodes || [])
    .map(child => domNodeToMarkdown(child, false))
    .filter(part => part.trim())
    .join('\n\n')
}

function domNodeToMarkdown(node, inline) {
  if (!node) return ''
  if (node.nodeType === 3) return node.textContent || ''
  if (node.nodeType !== 1) return ''

  const element = node
  const tag = element.tagName.toLowerCase()

  if (tag === 'br') return '\n'
  if (tag === 'hr') return '---'
  if (tag === 'img') return markdownImageFromElement(element)
  if (tag === 'figure') return markdownFigureFromElement(element)
  if (tag === 'pre') return '```\n' + (element.textContent || '').trim() + '\n```'
  if (tag === 'blockquote') {
    return inlineMarkdown(element).split('\n').map(line => '> ' + line).join('\n')
  }
  if (/^h[1-6]$/.test(tag)) {
    const level = Math.min(Number(tag.slice(1)), 3)
    return '#'.repeat(level) + ' ' + inlineMarkdown(element).trim()
  }
  if (tag === 'ul' || tag === 'ol') {
    return Array.from(element.children || [])
      .filter(child => child.tagName?.toLowerCase() === 'li')
      .map((child, index) => (tag === 'ol' ? (index + 1) + '. ' : '- ') + inlineMarkdown(child).trim())
      .join('\n')
  }
  if (tag === 'p' || tag === 'div' || tag === 'li') {
    const value = inlineMarkdown(element).trim()
    return inline ? value : value
  }

  return inlineMarkdown(element).trim()
}

function inlineMarkdown(element) {
  return Array.from(element.childNodes || [])
    .map(child => inlineNodeToMarkdown(child))
    .join('')
    .replace(/\n{3,}/g, '\n\n')
}

function inlineNodeToMarkdown(node) {
  if (!node) return ''
  if (node.nodeType === 3) return node.textContent || ''
  if (node.nodeType !== 1) return ''

  const element = node
  const tag = element.tagName.toLowerCase()
  const text = inlineMarkdown(element)

  if (tag === 'br') return '\n'
  if (tag === 'strong' || tag === 'b') return '**' + text + '**'
  if (tag === 'em' || tag === 'i') return '*' + text + '*'
  if (tag === 'code') return '`' + (element.textContent || '') + '`'
  if (tag === 'img') return markdownImageFromElement(element)
  if (tag === 'figure') return markdownFigureFromElement(element)
  if (tag === 'span') {
    const color = element.style?.color || ''
    if (color) return '<span style="color: ' + normalizeCssColor(color) + ';">' + text + '</span>'
    return text
  }
  if (tag === 'a') return markdownLinkFromElement(element, text)

  return text
}

function markdownLinkFromElement(element, text) {
  const cleanText = (text || element.textContent || '').trim()
  const href = element.getAttribute('href') || ''

  if (element.classList?.contains('wiki-tag')) {
    return '[[#' + cleanText.replace(/^#/, '') + ']]'
  }

  if (element.classList?.contains('wiki-link')) {
    try {
      const url = new URL(href, window.location.origin)
      const branch = url.searchParams.get('branch')
      return branch && branch !== cleanText ? '[[' + branch + '|' + cleanText + ']]' : '[[' + cleanText + ']]'
    } catch (error) {
      return '[[' + cleanText + ']]'
    }
  }

  return href ? '[' + cleanText + '](' + href + ')' : cleanText
}

function markdownFigureFromElement(element) {
  const img = element.querySelector('img')
  if (!img) return inlineMarkdown(element)
  const caption = element.querySelector('figcaption')?.textContent?.trim()
  return markdownImageFromElement(img, caption)
}

function markdownImageFromElement(element, caption = '') {
  const src = element.getAttribute('src') || ''
  if (!src) return ''
  const alt = caption || element.getAttribute('alt') || 'image'
  return '![' + alt + '](' + src + ')'
}

function normalizeCssColor(color) {
  const value = String(color || '').trim()
  const rgb = value.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/i)
  if (!rgb) return value
  return '#' + rgb.slice(1).map(part => Number(part).toString(16).padStart(2, '0')).join('')
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

async function uploadArticleAttachment(supabase, file) {
  const sessionResult = await supabase.auth.getSession()
  const userId = sessionResult?.data?.session?.user?.id || 'anonymous'
  const path = 'article-attachments/' + userId + '/' + safeFileName(file.name)
  const upload = await supabase.storage.from('avatars').upload(path, file)
  if (upload.error) throw new Error('附件上传失败：' + upload.error.message)
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

async function handleAttachmentUpload(event) {
  const file = event.target.files?.[0]
  if (!file) return
  await insertAttachmentFile(file)
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

async function insertAttachmentFile(file) {
  if (article.visibility !== 'internal') {
    showStatus('只有内部文章可以上传附件', 'error')
    return
  }
  try {
    const supabase = await waitForSupabase()
    if (!supabase) throw new Error('Supabase 未加载，请刷新页面后重试')
    const url = await uploadArticleAttachment(supabase, file)
    selectedAttachment.value = file.name
    insertAtCursor('\n\n[📎 下载附件：' + file.name + '](' + url + ')\n\n')
    showStatus('附件已上传并插入正文', 'success')
  } catch (error) {
    showStatus(error.message || '附件上传失败', 'error')
  }
}

function insertBlock(type) {
  if (type === 'h2') return lineBlock('## ', '小节标题')
  if (type === 'h3') return lineBlock('### ', '子标题')
  if (type === 'bold') return wrapSelection('**', '**', '加粗文字')
  if (type === 'italic') return wrapSelection('*', '*', '斜体文字')
  if (type === 'quote') return lineBlock('> ', '引用内容')
  if (type === 'code') return wrapSelection('\n\n```js\n', '\n```\n\n', '// code')
  if (type === 'ul') return insertAtCursor('\n\n- 列表项\n- 列表项\n\n')
  if (type === 'ol') return insertAtCursor('\n\n1. 列表项\n2. 列表项\n\n')
  if (type === 'link') return wrapSelection('[', '](https://example.com)', '链接文字')
  if (type === 'image') return triggerImageSelect()
  if (type === 'hr') return insertAtCursor('\n\n---\n\n')
  insertAtCursor('\n\n')
}

function lineBlock(prefix, placeholder) {
  const selected = getSelectionText()
  insertAtCursor('\n\n' + prefix + (selected || placeholder) + '\n\n', selected ? null : placeholder)
}

function wrapSelection(before, after, placeholder) {
  const selected = getSelectionText()
  insertAtCursor(before + (selected || placeholder) + after, selected ? null : placeholder)
}

function applyColor(color) {
  const selected = getSelectionText()
  insertAtCursor('<span style="color: ' + color + ';">' + (selected || '彩色文字') + '</span>', selected ? null : '彩色文字')
}

function getSelectionText() {
  const previewSelection = getPreviewSelection()
  if (previewSelection) return previewSelection.toString()

  const textarea = contentInput.value
  if (!textarea) return ''
  return article.content.slice(textarea.selectionStart, textarea.selectionEnd)
}

function insertAtCursor(text, selectText = null) {
  const previewSelection = getPreviewSelection()
  if (previewSelection) {
    previewSelection.deleteContents()
    previewSelection.insertNode(document.createTextNode(text))
    syncPreviewEdit({ currentTarget: previewInput.value })
    return
  }

  const textarea = contentInput.value
  if (!textarea || textarea.offsetParent === null) {
    article.content += text
    return
  }

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  article.content = article.content.slice(0, start) + text + article.content.slice(end)

  requestAnimationFrame(() => {
    textarea.focus()
    if (selectText) {
      const selectedStart = start + text.indexOf(selectText)
      textarea.selectionStart = selectedStart
      textarea.selectionEnd = selectedStart + selectText.length
    } else {
      textarea.selectionStart = textarea.selectionEnd = start + text.length
    }
  })
}

function getPreviewSelection() {
  if (typeof window === 'undefined' || !previewInput.value) return null
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return null
  const range = selection.getRangeAt(0)
  return previewInput.value.contains(range.commonAncestorContainer) ? range : null
}

async function waitForSupabase(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    if (typeof window !== 'undefined' && window.__supabase) return window.__supabase
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  return null
}

async function loadKnowledgeBranches() {
  kbLoading.value = true
  kbError.value = ''

  try {
    const supabase = await waitForSupabase()
    if (!supabase) {
      kbError.value = 'Supabase 未加载，知识库分支暂不可选'
      return
    }

    const { data, error } = await supabase
      .from('knowledge_branches')
      .select('id, parent_id, name, sort_order')
      .order('sort_order', { ascending: true })

    if (error) {
      kbError.value = '请先执行 supabase/knowledge-base.sql'
      kbBranches.value = []
      return
    }

    kbBranches.value = data || []
  } catch (error) {
    kbError.value = '知识库分支加载失败'
  } finally {
    kbLoading.value = false
  }
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

  if (article.visibility === 'internal') syncVisibilityMode()

  const requestedBranchPath = normalizeBranchPath(article.kbBranchPath)
  if (article.visibility !== 'internal' && article.kbEnabled && !article.kbBranchId && !requestedBranchPath) {
    showStatus('请选择已有知识库分支，或输入要申请的新分支路径', 'error')
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

    if (article.visibility !== 'internal' && (article.kbEnabled || kbBranches.value.length > 0)) {
      articleData.kb_enabled = !!article.kbEnabled && !requestedBranchPath
      articleData.kb_branch_id = article.kbEnabled ? article.kbBranchId : null
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

    if (article.visibility !== 'internal' && article.kbEnabled && requestedBranchPath) {
      const requestResult = await supabase
        .from('knowledge_branch_requests')
        .insert({
          article_id: insertedArticle.id,
          requester_id: userId,
          requested_path: requestedBranchPath,
          status: 'pending'
        })
        .select('id')
        .single()

      if (requestResult.error) {
        showStatus('文章已提交，但新分支申请失败：' + requestResult.error.message + '。请确认已执行 supabase/knowledge-base.sql', 'error')
        return
      }
    }

    showStatus(status === 'pending' ? '提交成功，文章已进入待审核' : '草稿保存成功', 'success')
    if (status === 'pending') {
      setTimeout(() => {
        window.location.href = '/articles'
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
.knowledge-row,
.block-toolbar {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.btn,
.block-toolbar button,
.source-toggle,
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

.featured-visibility {
  padding: 1rem;
  border: 1px solid rgba(139, 31, 31, 0.28);
  border-radius: 10px;
  background: linear-gradient(135deg, rgba(139, 31, 31, 0.1), rgba(216, 30, 6, 0.04));
}

.featured-visibility .field-label {
  color: #8b1f1f;
}

.featured-visibility small {
  flex-basis: 100%;
  color: var(--vp-c-text-2);
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

.radio-pill:has(input:checked) {
  border-color: #8b1f1f;
  background: #8b1f1f;
  color: #fff;
}

.knowledge-row {
  padding: 0.75rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
}

.kb-toggle {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-weight: 700;
}

.kb-targets {
  display: grid;
  grid-template-columns: minmax(220px, 0.8fr) minmax(280px, 1.2fr);
  gap: 0.6rem;
  width: 100%;
}

.knowledge-row select,
.knowledge-row input[type='text'] {
  width: 100%;
  padding: 0.45rem 0.65rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}

.knowledge-row small {
  color: var(--vp-c-text-2);
}

.import-panel {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 0.75rem;
  margin: 1.25rem 0;
}

.import-tile {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.25rem;
  padding: 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  text-align: left;
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
}

.import-action {
  display: grid;
  gap: 0.25rem;
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.import-action span {
  color: var(--vp-c-text-2);
  font-size: 0.85rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.clear-upload {
  display: grid;
  place-items: center;
  width: 1.9rem;
  height: 1.9rem;
  border: 1px solid rgba(139, 31, 31, 0.2);
  border-radius: 999px;
  background: var(--vp-c-bg);
  color: #8b1f1f;
  cursor: pointer;
}

.clear-upload:hover {
  border-color: #8b1f1f;
  background: rgba(139, 31, 31, 0.08);
}

.clear-upload svg {
  width: 1rem;
  height: 1rem;
  fill: currentColor;
}

.attachment-tile {
  border-color: rgba(139, 31, 31, 0.35);
  background: rgba(139, 31, 31, 0.06);
}

.body-panel {
  margin-bottom: 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  overflow: hidden;
  background: var(--vp-c-bg);
}

.body-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem;
  background: var(--vp-c-bg-soft);
  font-weight: 700;
}

.block-toolbar {
  flex: 1;
  justify-content: flex-start;
  width: auto;
}

.tool-button,
.color-button,
.source-toggle {
  display: inline-grid;
  place-items: center;
  width: 2.35rem;
  height: 2.35rem;
  padding: 0;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
}

.tool-button:hover,
.color-button:hover,
.source-toggle:hover,
.source-toggle.active {
  border-color: var(--vp-c-brand-1);
  color: var(--vp-c-brand-1);
}

.tool-button svg,
.source-toggle svg {
  width: 1.18rem;
  height: 1.18rem;
  fill: currentColor;
}

.source-toggle {
  flex: 0 0 auto;
}

.toolbar-divider {
  width: 1px;
  height: 1.7rem;
  background: var(--vp-c-divider);
}

.color-button::before {
  content: '';
  width: 1.15rem;
  height: 1.15rem;
  border: 2px solid rgba(255, 255, 255, 0.78);
  border-radius: 999px;
  background: var(--swatch);
  box-shadow: 0 0 0 1px var(--vp-c-divider);
}

.content-editor {
  min-height: 560px;
  padding: 1.35rem;
  border: 0;
  border-right: 1px solid var(--vp-c-divider);
  border-radius: 0;
  resize: vertical;
  background:
    linear-gradient(var(--vp-c-bg) 0 0) padding-box,
    repeating-linear-gradient(
      to bottom,
      transparent 0,
      transparent 2.08rem,
      color-mix(in srgb, var(--vp-c-divider) 55%, transparent) 2.1rem
    );
  color: var(--vp-c-text-1);
  font-size: 1rem;
  line-height: 2.1;
}

.editor-workspace {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  min-height: 560px;
}

.editor-workspace.with-source {
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.content-preview {
  background: var(--vp-c-bg);
  min-width: 0;
  min-height: 560px;
  overflow: auto;
}

.preview-body {
  width: min(100%, 920px);
  margin: 0 auto;
  padding: 2.2rem clamp(1.2rem, 4vw, 3rem);
  color: var(--vp-c-text-1);
  font-size: 1.02rem;
  line-height: 1.9;
}

.editable-preview {
  min-height: 560px;
  cursor: text;
}

.editable-preview:empty::before {
  content: attr(data-placeholder);
  display: grid;
  place-items: center;
  min-height: 480px;
  color: var(--vp-c-text-2);
  text-align: center;
  font-size: 0.9rem;
}

.editable-preview:focus {
  outline: 2px solid var(--vp-c-brand-soft);
  outline-offset: -2px;
}

.preview-body h1,
.preview-body h2,
.preview-body h3 {
  margin: 1.1rem 0 0.55rem;
  line-height: 1.35;
}

.preview-body h1 {
  font-size: clamp(1.8rem, 4vw, 2.7rem);
}

.preview-body h2 {
  font-size: 1.45rem;
}

.preview-body h3 {
  font-size: 1.18rem;
}

.preview-body p {
  margin: 0.72rem 0;
}

.preview-body a {
  color: var(--vp-c-brand-1);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.preview-body .wiki-link,
.preview-body .wiki-tag {
  display: inline-flex;
  align-items: center;
  padding: 0 0.18rem;
  border-radius: 5px;
  background: rgba(139, 31, 31, 0.08);
  color: #8b1f1f;
  font-weight: 700;
  text-decoration: none;
}

.preview-body .wiki-tag {
  background: rgba(124, 58, 237, 0.1);
  color: #7c3aed;
}

.preview-body blockquote {
  margin: 1rem 0;
  padding: 0.8rem 1rem;
  border-left: 4px solid var(--vp-c-brand-1);
  border-radius: 6px;
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
}

.preview-body ul,
.preview-body ol {
  padding-left: 1.4rem;
}

.preview-body hr {
  margin: 1.2rem 0;
  border: 0;
  border-top: 1px solid var(--vp-c-divider);
}

.preview-body code {
  padding: 0.12rem 0.32rem;
  border-radius: 4px;
  background: var(--vp-c-bg-soft);
}

.preview-body pre {
  overflow: auto;
  padding: 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 8px;
  background: var(--vp-c-bg);
}

.preview-body pre code {
  padding: 0;
  background: transparent;
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
  min-height: 560px;
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

  .editor-workspace.with-source {
    grid-template-columns: 1fr;
  }

  .content-editor {
    border-right: 0;
    border-bottom: 1px solid var(--vp-c-divider);
  }

  .content-preview {
    border-left: 0;
    border-top: 1px solid var(--vp-c-divider);
    min-height: 320px;
  }

  .tag-row,
  .visibility-row,
  .knowledge-row {
    flex-direction: column;
    align-items: stretch;
  }

  .kb-targets {
    grid-template-columns: 1fr;
  }
}
</style>
