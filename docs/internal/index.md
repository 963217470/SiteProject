---
title: 内部文章
layout: page
---

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useAuth } from '../.vitepress/theme/composables/useAuth'
import { usePermissions } from '../.vitepress/theme/composables/usePermissions'
import { requireSupabase } from '../.vitepress/theme/lib/supabase'
import { AppError, toUserMessage } from '../.vitepress/theme/lib/errors'

const loading = ref(true)
const notMember = ref(false)
const auth = useAuth()
const { isAdmin, canAccessInternal } = usePermissions(auth.profile)
const articles = ref([])
const resources = ref([])
const resourceError = ref('')
const resourceBusy = ref(false)
const resourceDownloadBusy = ref('')
const resourceFile = ref(null)
const selectedTags = ref([])
const sortOrder = ref('newest')
const resourceForm = ref({
  title: '',
  description: '',
  category: '',
  version: ''
})
let supabase = null

const availableTags = ['Unity', 'Godot', 'Unreal Engine', 'Cocos Creator', 'C#', 'GDScript', 'C++', 'Lua', '教程', '入门', '进阶', '会议记录']

onMounted(async () => {
  try {
    await auth.initializeAuth()
    supabase = requireSupabase()
    if (!canAccessInternal.value) { notMember.value = true; return }
    const { data } = await supabase.from('articles').select('id, title, summary, cover_url, tags, created_at, profiles!articles_author_id_fkey(username)').eq('status', 'published').eq('visibility', 'internal').order('created_at', { ascending: false })
    articles.value = data || []
    await loadResources()
  } catch (e) { resourceError.value = toUserMessage(e) }
  finally { loading.value = false }
})

const filteredArticles = computed(() => {
  let result = [...articles.value]
  if (selectedTags.value.length > 0) result = result.filter(a => a.tags && a.tags.some(t => selectedTags.value.includes(t)))
  if (sortOrder.value === 'newest') result.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  return result
})

function toggleTag(tag) {
  const i = selectedTags.value.indexOf(tag)
  if (i === -1) selectedTags.value.push(tag)
  else selectedTags.value.splice(i, 1)
}

function formatDate(d) { return new Date(d).toLocaleDateString('zh-CN') }
function formatSize(size) {
  const value = Number(size || 0)
  if (!value) return ''
  if (value < 1024 * 1024) return Math.max(1, Math.round(value / 1024)) + ' KB'
  return (value / 1024 / 1024).toFixed(value > 100 * 1024 * 1024 ? 0 : 1) + ' MB'
}

async function loadResources() {
  resourceError.value = ''
  try {
    const { data, error } = await supabase
      .from('internal_resources')
      .select('id, title, description, category, version, file_path, file_name, file_size, created_at')
      .eq('status', 'published')
      .order('created_at', { ascending: false })
    if (error) {
      resources.value = []
      resourceError.value = toUserMessage(error)
      return
    }
    resources.value = data || []
  } catch (e) {
    resourceError.value = toUserMessage(e)
  }
}

function handleResourceFile(event) {
  resourceFile.value = event.target.files?.[0] || null
}

function safePathName(name) {
  return String(name || 'download')
    .replace(/[\\/:*?"<>|#%{}^~[\]`]/g, '-')
    .replace(/\s+/g, '-')
    .slice(0, 120)
}

async function publishResource() {
  if (!isAdmin.value || resourceBusy.value) return
  const title = resourceForm.value.title.trim()
  const file = resourceFile.value
  if (!title || !file) {
    resourceError.value = '请填写资源名称并选择文件'
    return
  }

  resourceBusy.value = true
  resourceError.value = ''
  try {
    const currentUser = auth.user.value
    if (!currentUser) throw new AppError('auth')
    const path = [
      currentUser.id,
      Date.now() + '-' + safePathName(file.name)
    ].join('/')

    const upload = await supabase.storage.from('resources').upload(path, file)
    if (upload.error) throw upload.error
    const insert = await supabase.from('internal_resources').insert({
      title,
      description: resourceForm.value.description.trim(),
      category: resourceForm.value.category.trim(),
      version: resourceForm.value.version.trim(),
      file_url: null,
      file_path: path,
      file_name: file.name,
      file_size: file.size,
      status: 'published',
      created_by: currentUser.id
    }).select('id').single()
    if (insert.error) throw insert.error
    resourceForm.value = { title: '', description: '', category: '', version: '' }
    resourceFile.value = null
    const input = document.getElementById('resource-file')
    if (input) input.value = ''
    await loadResources()
  } catch (e) {
    resourceError.value = toUserMessage(e)
  } finally {
    resourceBusy.value = false
  }
}

async function downloadResource(item) {
  if (!item.file_path || resourceDownloadBusy.value) return
  resourceDownloadBusy.value = item.id
  resourceError.value = ''
  try {
    const result = await supabase.storage.from('resources').createSignedUrl(item.file_path, 60)
    if (result.error || !result.data?.signedUrl) {
      throw result.error || new AppError('unknown')
    }
    window.location.assign(result.data.signedUrl)
  } catch (e) {
    resourceError.value = toUserMessage(e)
  } finally {
    resourceDownloadBusy.value = ''
  }
}
</script>

<div class="internal-page">
<h1>🔒 内部文章</h1>
<div v-show="loading" class="loading-state"><p>加载中...</p></div>
<div v-show="notMember && !loading" class="not-member"><p>请先 <a href="/login">登录</a> 以查看内部文章</p></div>
<div v-show="!loading && !notMember">
<div class="internal-notice"><p>⚠️ 此区域仅社员可见，请勿外传</p></div>
<section class="resources-section">
<div class="section-heading">
<div>
<p class="section-kicker">资源软件</p>
<h2>内部下载</h2>
</div>
<span>{{ resources.length }} 个资源</span>
</div>
<form v-if="isAdmin" class="resource-form" @submit.prevent="publishResource">
<div class="form-grid">
<label><span>资源名称</span><input v-model="resourceForm.title" type="text" placeholder="Blender 插件包 / UE 工具集"></label>
<label><span>分类</span><input v-model="resourceForm.category" type="text" placeholder="软件 / 插件 / 素材"></label>
<label><span>版本</span><input v-model="resourceForm.version" type="text" placeholder="v1.0 / 2026.05"></label>
<label><span>文件</span><input id="resource-file" type="file" @change="handleResourceFile"></label>
</div>
<label class="description-field"><span>说明</span><textarea v-model="resourceForm.description" rows="3" placeholder="写清用途、安装方式或注意事项"></textarea></label>
<button class="publish-resource" type="submit" :disabled="resourceBusy">{{ resourceBusy ? '发布中...' : '发布资源' }}</button>
</form>
<p v-if="resourceError" class="resource-error">{{ resourceError }}</p>
<div v-if="resources.length" class="resource-list">
<article v-for="item in resources" :key="item.id" class="resource-card">
<div class="resource-main">
<div class="resource-icon">⬇</div>
<div>
<h3>{{ item.title }}</h3>
<p v-if="item.description">{{ item.description }}</p>
<div class="resource-meta">
<span v-if="item.category">{{ item.category }}</span>
<span v-if="item.version">{{ item.version }}</span>
<span v-if="item.file_size">{{ formatSize(item.file_size) }}</span>
<span>{{ formatDate(item.created_at) }}</span>
</div>
</div>
</div>
<button class="download-btn" type="button" :disabled="resourceDownloadBusy === item.id" @click="downloadResource(item)">{{ resourceDownloadBusy === item.id ? '准备中...' : '下载' }}</button>
</article>
</div>
<div v-else-if="!resourceError" class="no-resources">暂无内部资源</div>
</section>
<div class="filter-section">
<div class="tag-filter">
<span>标签筛选：</span>
<button v-for="tag in availableTags" :key="tag" :class="['tag', { active: selectedTags.includes(tag) }]" @click="toggleTag(tag)">{{ tag }}</button>
</div>
<div class="sort-filter">
<span>排序：</span>
<select v-model="sortOrder" class="sort-select"><option value="newest">最新</option></select>
</div>
</div>
<div class="article-list">
<a v-for="a in filteredArticles" :key="a.id" :href="'/article?id=' + a.id" class="article-card">
<div v-if="a.cover_url" class="article-cover"><img :src="a.cover_url" :alt="a.title"></div>
<div class="article-info">
<h3>🔒 {{ a.title }}</h3>
<p v-if="a.summary" class="article-summary">{{ a.summary }}</p>
<div class="article-meta">
<span class="author">{{ a.profiles?.username || '未知' }}</span>
<span>{{ formatDate(a.created_at) }}</span>
</div>
<div v-if="a.tags && a.tags.length > 0" class="article-tags">
<span v-for="t in a.tags" :key="t" class="tag-item">{{ t }}</span>
</div>
</div>
</a>
</div>
<div v-if="!loading && filteredArticles.length === 0" class="no-articles"><p>暂无内部文章</p></div>
</div>
</div>

<style scoped>
.internal-page { max-width: 980px; margin: 0 auto; padding: 2rem; }
.internal-page h1 { margin: 0 0 1.5rem 0; }
.loading-state, .not-member { text-align: center; padding: 3rem; color: var(--vp-c-text-2); }
.not-member a { color: var(--vp-c-brand-1); }
.internal-notice { padding: 0.75rem 1rem; background: #fef3c7; border: 1px solid #fcd34d; border-radius: 8px; margin-bottom: 1.5rem; color: #92400e; font-size: 0.9rem; }
.internal-notice p { margin: 0; }
.resources-section { margin-bottom: 2rem; padding: 1.25rem; border: 1px solid var(--vp-c-divider); border-radius: 8px; background: var(--vp-c-bg-soft); }
.section-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; margin-bottom: 1rem; }
.section-heading h2 { margin: 0; font-size: 1.35rem; }
.section-heading > span { color: var(--vp-c-text-2); font-size: 0.85rem; }
.section-kicker { margin: 0 0 0.2rem; color: var(--vp-c-brand-1); font-size: 0.78rem; font-weight: 700; letter-spacing: 0; }
.resource-form { display: grid; gap: 0.9rem; margin-bottom: 1.2rem; padding: 1rem; border: 1px solid var(--vp-c-divider); border-radius: 8px; background: var(--vp-c-bg); }
.form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.85rem; }
.resource-form label { display: grid; gap: 0.35rem; color: var(--vp-c-text-2); font-size: 0.85rem; font-weight: 600; }
.resource-form input, .resource-form textarea { width: 100%; padding: 0.65rem 0.75rem; border: 1px solid var(--vp-c-divider); border-radius: 6px; background: var(--vp-c-bg); color: var(--vp-c-text-1); font: inherit; }
.description-field { grid-column: 1 / -1; }
.publish-resource { justify-self: start; padding: 0.65rem 1.05rem; border: 1px solid #8b1f1f; border-radius: 8px; background: #8b1f1f; color: #fff; cursor: pointer; font: inherit; font-weight: 700; }
.publish-resource:disabled { cursor: not-allowed; opacity: 0.65; }
.resource-error { margin: 0 0 1rem; padding: 0.75rem 0.9rem; border-radius: 6px; background: #fee2e2; color: #991b1b; }
.resource-list { display: grid; gap: 0.85rem; }
.resource-card { display: flex; justify-content: space-between; gap: 1rem; align-items: center; padding: 1rem; border: 1px solid var(--vp-c-divider); border-radius: 8px; background: var(--vp-c-bg); }
.resource-main { display: flex; gap: 0.85rem; min-width: 0; }
.resource-icon { display: grid; place-items: center; flex: 0 0 auto; width: 2.4rem; height: 2.4rem; border-radius: 8px; background: rgba(139, 31, 31, 0.1); color: #8b1f1f; font-weight: 800; }
.resource-card h3 { margin: 0 0 0.35rem; font-size: 1rem; }
.resource-card p { margin: 0 0 0.5rem; color: var(--vp-c-text-2); font-size: 0.88rem; line-height: 1.5; }
.resource-meta { display: flex; gap: 0.45rem; flex-wrap: wrap; color: var(--vp-c-text-3); font-size: 0.78rem; }
.resource-meta span { padding: 0.12rem 0.45rem; border-radius: 999px; background: var(--vp-c-bg-soft); }
.download-btn { flex: 0 0 auto; padding: 0.55rem 0.9rem; border-radius: 8px; background: #8b1f1f; color: #fff; text-decoration: none; font-size: 0.88rem; font-weight: 700; }
.download-btn:hover { background: #6f1818; color: #fff; }
.no-resources { padding: 1.5rem; border: 1px dashed var(--vp-c-divider); border-radius: 8px; color: var(--vp-c-text-2); text-align: center; background: var(--vp-c-bg); }
.filter-section { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 2rem; padding: 1rem; background: var(--vp-c-bg-soft); border-radius: 8px; }
.tag-filter { display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; }
.tag-filter span { font-weight: 500; font-size: 0.875rem; }
.tag { display: inline-block; padding: 0.2rem 0.6rem; font-size: 0.8rem; border-radius: 16px; background: var(--vp-c-bg); border: 1px solid var(--vp-c-divider); cursor: pointer; transition: all 0.2s; }
.tag:hover { border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); }
.tag.active { background: var(--vp-c-brand-1); color: white; border-color: var(--vp-c-brand-1); }
.sort-filter { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; }
.sort-select { padding: 0.4rem 0.75rem; border: 1px solid var(--vp-c-divider); border-radius: 4px; background: var(--vp-c-bg); font-size: 0.875rem; }
.article-list { display: flex; flex-direction: column; gap: 1rem; }
.article-card { display: flex; gap: 1.25rem; border: 1px solid var(--vp-c-divider); border-radius: 8px; padding: 1.25rem; text-decoration: none; color: inherit; transition: all 0.2s; }
.article-card:hover { border-color: var(--vp-c-brand-1); box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06); }
.article-cover { flex-shrink: 0; width: 180px; height: 110px; border-radius: 6px; overflow: hidden; }
.article-cover img { width: 100%; height: 100%; object-fit: cover; }
.article-info { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.article-info h3 { margin: 0 0 0.4rem 0; font-size: 1.15rem; color: var(--vp-c-text-1); }
.article-summary { margin: 0 0 0.5rem 0; font-size: 0.85rem; color: var(--vp-c-text-2); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.article-meta { display: flex; gap: 1rem; font-size: 0.8rem; color: var(--vp-c-text-2); margin-bottom: 0.5rem; }
.author { font-weight: 500; color: var(--vp-c-text-1); }
.article-tags { display: flex; gap: 0.4rem; margin-top: auto; flex-wrap: wrap; }
.tag-item { padding: 0.15rem 0.5rem; background: var(--vp-c-bg-soft); border-radius: 4px; font-size: 0.75rem; color: var(--vp-c-text-2); }
.no-articles { text-align: center; padding: 3rem; color: var(--vp-c-text-2); background: var(--vp-c-bg-soft); border-radius: 8px; }
.no-articles p { margin: 0; }
@media (max-width: 768px) { .form-grid { grid-template-columns: 1fr; } .resource-card { align-items: stretch; flex-direction: column; } .download-btn { text-align: center; } .article-card { flex-direction: column; } .article-cover { width: 100%; height: 160px; } }
</style>
