<template>
  <section class="upload-tokens" aria-labelledby="upload-token-heading">
    <h2 id="upload-token-heading">笔记上传授权</h2>
    <p v-if="loading" role="status">加载账号中…</p>
    <p v-else-if="!user"><a href="/login">使用 GitHub 登录</a>后创建上传令牌。</p>
    <template v-else>
      <p>{{ user.user_metadata?.user_name || '当前账号' }} · 本人公开草稿与笔记图片 · 有效期 90 天</p>
      <form class="token-form" @submit.prevent="createToken">
        <label>令牌名称<input v-model="name" maxlength="60" required placeholder="例如：我的 V2md" :disabled="busy"></label>
        <button class="token-primary" :disabled="busy" type="submit"><KeyRound :size="18" />创建令牌</button>
      </form>
      <div v-if="secret" class="token-secret">
        <label>新令牌，仅本次显示<input :value="secret" readonly spellcheck="false" aria-label="新上传令牌"></label>
        <button type="button" title="复制上传令牌" aria-label="复制上传令牌" @click="copyToken"><Copy :size="18" /></button>
        <button type="button" title="隐藏上传令牌" aria-label="隐藏上传令牌" @click="secret = ''"><EyeOff :size="18" /></button>
      </div>
      <p v-if="message" role="status" class="token-message">{{ message }}</p>
      <p v-if="error" role="alert" class="token-error">{{ error }}</p>
      <ul v-if="tokens.length" class="token-list">
        <li v-for="token in tokens" :key="token.id">
          <div><strong>{{ token.name }}</strong><span>{{ token.revoked_at ? '已撤销' : token.expires_at <= Date.now() ? '已过期' : '有效至 ' + date(token.expires_at) }}</span></div>
          <button v-if="!token.revoked_at && token.expires_at > Date.now()" type="button" :disabled="busy" title="撤销上传令牌" @click="revoke(token)"><Trash2 :size="16" />撤销</button>
        </li>
      </ul>
      <p v-else>尚未创建上传令牌。</p>
    </template>
  </section>
</template>

<script setup>
import { onMounted, ref } from 'vue'
import { Copy, EyeOff, KeyRound, Trash2 } from 'lucide-vue-next'
const user=ref(null),tokens=ref([]),name=ref('我的 V2md'),secret=ref(''),loading=ref(true),busy=ref(false),error=ref(''),message=ref('')
const date=value=>new Date(value).toLocaleDateString('zh-CN')
async function api(path,options={}) {
  const response=await fetch(path,{credentials:'same-origin',...options,headers:{'Content-Type':'application/json','X-RD-CSRF':'1',...options.headers}})
  const data=await response.json()
  if(!response.ok)throw new Error(data.message||'请求失败')
  return data
}
async function refresh() {tokens.value=await api('/api/mcp-tokens')}
onMounted(async()=>{
  try {user.value=(await api('/api/auth/session')).session?.user||null;if(user.value)await refresh()}
  catch(e){error.value=e.message}
  finally{loading.value=false}
})
async function createToken() {
  if(busy.value)return
  busy.value=true;error.value='';message.value='';secret.value=''
  try {const data=await api('/api/mcp-tokens',{method:'POST',body:JSON.stringify({name:name.value.trim()})});secret.value=data.token;await refresh()}
  catch(e){error.value=e.message}
  finally{busy.value=false}
}
async function revoke(token) {
  busy.value=true;error.value='';message.value=''
  try{await api('/api/mcp-tokens/'+encodeURIComponent(token.id),{method:'DELETE'});secret.value='';await refresh();message.value='令牌已撤销'}
  catch(e){error.value=e.message}
  finally{busy.value=false}
}
async function copyToken() {
  try{await navigator.clipboard.writeText(secret.value);message.value='已复制令牌'}
  catch{error.value='复制失败，请选择令牌文本复制'}
}
</script>

<style scoped>
.upload-tokens{margin:32px 0;padding:24px 0;border-block:1px solid var(--vp-c-divider)}
.upload-tokens h2{margin-top:0;border:0;padding:0}
.token-form,.token-secret{display:flex;align-items:end;gap:12px;flex-wrap:wrap}
.token-form label,.token-secret label{display:grid;gap:8px;flex:1;min-width:0;font-weight:600}
.upload-tokens input{width:100%;min-height:42px;padding:8px 12px;border:1px solid var(--vp-c-divider);border-radius:6px;background:var(--vp-c-bg);color:var(--vp-c-text-1);font:inherit}
.token-secret{margin-top:16px}.token-secret input{font:13px monospace}
.upload-tokens button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:42px;padding:8px 12px;border:1px solid var(--vp-c-divider);border-radius:6px;color:var(--vp-c-text-1);background:var(--vp-c-bg);cursor:pointer;flex-shrink:0}
.upload-tokens button.token-primary{background:var(--vp-c-brand-1);color:#fff;border-color:transparent}
.upload-tokens button:disabled{opacity:.6;cursor:wait}
.token-list{list-style:none;padding:0!important}.token-list li{display:flex;justify-content:space-between;align-items:center;gap:16px;padding:14px 0;border-bottom:1px solid var(--vp-c-divider)}
.token-list li div{display:grid;gap:4px;min-width:0;overflow-wrap:anywhere}.token-list span{font-size:13px;color:var(--vp-c-text-2)}
.token-error{color:#b42e28}.token-message{color:var(--vp-c-text-2)}
@media(max-width:480px){.token-form label{flex-basis:100%}.token-secret label{flex-basis:100%}}
</style>
