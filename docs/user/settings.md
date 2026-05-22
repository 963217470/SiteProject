---
title: 个人设置
layout: page
---

<script setup>
import { ref, reactive, onMounted } from 'vue'

const loading = ref(true)
const notLoggedIn = ref(false)
const isSubmitting = ref(false)
const submitSuccess = ref(false)
const submitError = ref('')
const uploading = ref(false)

const currentProfile = reactive({
  username: '',
  avatar: '/SiteProject/images/default-avatar.svg',
  bio: ''
})

const newUsername = ref('')
const newBio = ref('')
const newAvatarPreview = ref('')

let supabaseClient = null
let userId = null

onMounted(async () => {
  try {
    if (!window.__supabase) { loading.value = false; return }
    supabaseClient = window.__supabase

    const { data: { session } } = await supabaseClient.auth.getSession()

    if (!session) {
      notLoggedIn.value = true
      loading.value = false
      return
    }

    userId = session.user.id
    const meta = session.user.user_metadata || {}

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (profile) {
      currentProfile.username = profile.username || ''
      currentProfile.avatar = profile.avatar_url || '/SiteProject/images/default-avatar.svg'
      currentProfile.bio = profile.bio || ''
    } else {
      currentProfile.username = meta.full_name || meta.user_name || session.user.email
      currentProfile.avatar = meta.avatar_url || '/SiteProject/images/default-avatar.svg'
    }

    newUsername.value = currentProfile.username
    newBio.value = currentProfile.bio
    newAvatarPreview.value = currentProfile.avatar

  } catch (e) {
    console.error('Settings load error:', e)
  } finally {
    loading.value = false
  }
})

async function handleAvatarChange(e) {
  const file = e.target.files[0]
  if (!file) return

  // 验证文件类型
  if (!file.type.startsWith('image/')) {
    alert('请选择图片文件')
    return
  }
  // 验证文件大小 (2MB)
  if (file.size > 2 * 1024 * 1024) {
    alert('图片大小不能超过 2MB')
    return
  }

  uploading.value = true
  try {
    // 生成唯一文件路径
    const ext = file.name.split('.').pop()
    const path = `avatars/${userId}/${Date.now()}.${ext}`

    // 上传到 Supabase Storage
    const { error: uploadError } = await supabaseClient
      .storage
      .from('avatars')
      .upload(path, file)

    if (uploadError) throw uploadError

    // 获取公开 URL
    const { data } = supabaseClient
      .storage
      .from('avatars')
      .getPublicUrl(path)

    newAvatarPreview.value = data.publicUrl
  } catch (e) {
    alert('上传失败：' + e.message)
  } finally {
    uploading.value = false
  }
}

async function handleSubmit() {
  isSubmitting.value = true
  submitError.value = ''

  try {
    const { error } = await supabaseClient
      .from('profile_changes')
      .insert({
        user_id: userId,
        username: newUsername.value,
        avatar_url: newAvatarPreview.value !== currentProfile.avatar ? newAvatarPreview.value : null,
        bio: newBio.value
      })

    if (error) throw error

    submitSuccess.value = true
    setTimeout(() => { submitSuccess.value = false }, 3000)
  } catch (e) {
    submitError.value = e.message || '提交失败，请稍后重试'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<div class="settings-root">
  <div v-show="notLoggedIn" class="not-logged-in">
    <p>请先 <a href="/SiteProject/login">登录</a></p>
  </div>

  <div v-show="loading && !notLoggedIn" class="loading-state">
    <p>加载中...</p>
  </div>

  <div v-show="!loading && !notLoggedIn" class="settings-page">
    <h1>⚙️ 个人设置</h1>
    <div v-if="submitSuccess" class="success-message">✅ 修改已提交，等待管理员审核</div>
    <div v-if="submitError" class="error-message">{{ submitError }}</div>
    <div class="settings-card">
      <div class="form-group">
        <label>头像</label>
        <div class="avatar-upload">
          <img :src="newAvatarPreview" alt="头像" class="current-avatar">
          <div class="upload-actions">
            <label class="upload-btn" :class="{ disabled: uploading }">
              {{ uploading ? '上传中...' : '上传新头像' }}
              <input type="file" accept="image/*" @change="handleAvatarChange" hidden :disabled="uploading">
            </label>
            <span v-if="uploading" class="upload-hint">正在上传...</span>
          </div>
        </div>
      </div>
      <div class="form-group">
        <label>昵称</label>
        <input v-model="newUsername" type="text" class="form-input" placeholder="请输入昵称">
      </div>
      <div class="form-group">
        <label>个人简介</label>
        <textarea v-model="newBio" class="form-textarea" placeholder="介绍一下自己..." rows="4"></textarea>
      </div>
      <div class="form-hint">
        <p>⚠️ 修改昵称、头像、简介需要管理员审核</p>
        <p>提交后将在审核通过后生效</p>
      </div>
      <button class="submit-btn" @click="handleSubmit" :disabled="isSubmitting">{{ isSubmitting ? '提交中...' : '保存修改' }}</button>
    </div>
  </div>
</div>

<style scoped>
.not-logged-in, .loading-state { text-align: center; padding: 4rem 2rem; color: var(--vp-c-text-2); }
.not-logged-in a { color: var(--vp-c-brand-1); }
.settings-page { max-width: 600px; margin: 0 auto; padding: 2rem; }
.settings-page h1 { margin: 0 0 2rem 0; }
.success-message { padding: 1rem; background: #d1fae5; border: 1px solid #a7f3d0; border-radius: 8px; color: #065f46; margin-bottom: 1.5rem; }
.error-message { padding: 1rem; background: #fee2e2; border: 1px solid #fecaca; border-radius: 8px; color: #dc2626; margin-bottom: 1.5rem; }
.settings-card { padding: 2rem; background: var(--vp-c-bg-soft); border-radius: 12px; }
.form-group { margin-bottom: 1.5rem; }
.form-group label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
.avatar-upload { display: flex; align-items: center; gap: 1.5rem; }
.current-avatar { width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 3px solid var(--vp-c-brand-1); }
.upload-actions { display: flex; flex-direction: column; gap: 0.5rem; }
.upload-btn { padding: 0.75rem 1.5rem; background: var(--vp-c-bg); border: 1px solid var(--vp-c-divider); border-radius: 8px; cursor: pointer; transition: all 0.3s ease; }
.upload-btn:hover:not(.disabled) { border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); }
.upload-btn.disabled { opacity: 0.6; cursor: not-allowed; }
.upload-hint { font-size: 0.875rem; color: var(--vp-c-text-2); }
.form-input, .form-textarea { width: 100%; padding: 0.75rem 1rem; border: 1px solid var(--vp-c-divider); border-radius: 8px; font-size: 1rem; background: var(--vp-c-bg); transition: border-color 0.3s ease; }
.form-input:focus, .form-textarea:focus { outline: none; border-color: var(--vp-c-brand-1); }
.form-textarea { resize: vertical; min-height: 100px; }
.form-hint { padding: 1rem; background: #fef3c7; border-radius: 8px; margin-bottom: 1.5rem; }
.form-hint p { margin: 0; font-size: 0.875rem; color: #92400e; }
.form-hint p + p { margin-top: 0.25rem; }
.submit-btn { width: 100%; padding: 1rem; background: var(--vp-c-brand-1); color: white; border: none; border-radius: 8px; font-size: 1rem; font-weight: 500; cursor: pointer; transition: background 0.3s ease; }
.submit-btn:hover:not(:disabled) { background: var(--vp-c-brand-2); }
.submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
