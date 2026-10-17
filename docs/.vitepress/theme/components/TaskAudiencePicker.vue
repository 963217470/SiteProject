<template>
  <fieldset class="task-audience" :disabled="disabled">
    <legend>派发对象</legend>
    <label>范围<select v-model="kind"><option value="open">公开任务 · 自行领取</option><option value="users">指定成员</option><option value="level">同一经验等级</option><option value="discipline">同一专业分支</option><option value="office">同一职位</option><option value="role">同一站内角色</option><option value="all">当前全体成员</option></select></label>
    <label v-if="options.length">成员身份<select v-model="value"><option value="" disabled>请选择</option><option v-for="option in options" :key="option.id" :value="String(option.id)">{{ option.name }}</option></select></label>
    <template v-if="kind === 'users'">
      <label>查找成员<input v-model="search" maxlength="100" @keydown.enter.prevent="find"></label><button type="button" class="rd-button" :disabled="searching" @click="find"><Search :size="16" />查找</button>
      <div class="audience-members"><label v-for="person in people" :key="person.id"><input type="checkbox" :checked="selected.some(p=>p.id===person.id)" @change="toggle(person,$event.target.checked)">{{ person.username }}</label></div>
      <p v-if="searched && !people.length">未找到成员</p>
      <div class="audience-members"><button v-for="person in selected" :key="person.id" type="button" class="rd-button" :aria-label="'移除接收人 '+person.username" @click="toggle(person,false)">{{ person.username }}<X :size="14" /></button></div>
    </template>
    <div v-if="kind !== 'open'"><button type="button" class="rd-button" :disabled="previewing || !valid" @click="preview"><Users :size="16" />核对人数</button><span v-if="count !== null" role="status"> 当前匹配 {{ count }} 人</span><p class="task-meta">名单在发布时固定，自动加入任务。派发任务需填写截止时间。</p></div>
    <p v-if="error" role="alert">{{ error }}</p>
  </fieldset>
</template>
<script setup>
import { computed, ref, watch } from 'vue'
import { Search, Users, X } from 'lucide-vue-next'
import { taskRequest } from '../lib/task-api.mjs'
const props = defineProps({ modelValue: Object, levels: { type: Array, default: ()=>[] }, disciplines: { type: Array, default: ()=>[] }, disabled: Boolean })
const emit = defineEmits(['update:modelValue'])
const kind=ref('open'), value=ref(''), search=ref(''), people=ref([]), selected=ref([]), count=ref(null), error=ref(''), searching=ref(false), searched=ref(false), previewing=ref(false)
const options=computed(()=>({level:props.levels.map(l=>({id:l.threshold,name:l.title})),discipline:props.disciplines,office:[{id:'president',name:'会长'},{id:'vice-president',name:'副会长'}],role:[{id:'user',name:'普通用户'},{id:'member',name:'社员角色'},{id:'admin',name:'管理员'}]}[kind.value]||[]))
const audience=computed(()=>kind.value==='open'?null:kind.value==='users'?{kind:'users',ids:selected.value.map(p=>p.id)}:kind.value==='all'?{kind:'all'}:{kind:kind.value,value:value.value})
const valid=computed(()=>kind.value==='all'||(kind.value==='users'?selected.value.length>0:Boolean(value.value)))
let revision=0
watch(kind,()=>{value.value='';error.value=''})
watch(audience,result=>{++revision;count.value=null;emit('update:modelValue',result)},{immediate:true})
function toggle(person,checked){selected.value=checked?[...selected.value.filter(p=>p.id!==person.id),person]:selected.value.filter(p=>p.id!==person.id)}
async function find(){if(searching.value)return;searching.value=true;error.value='';try{people.value=await taskRequest('/people?q='+encodeURIComponent(search.value));searched.value=true}catch(e){error.value=e.message}finally{searching.value=false}}
async function preview(){if(previewing.value)return;const run=revision;previewing.value=true;error.value='';try{const result=await taskRequest('/audience/preview',{method:'POST',body:{audience:audience.value}});if(run===revision)count.value=result.count}catch(e){if(run===revision)error.value=e.message}finally{previewing.value=false}}
</script>
<style scoped>
.task-audience{display:grid;gap:12px;min-width:0;margin:20px 0;padding:16px 0;border:0;border-block:1px solid var(--vp-c-divider)}
.task-audience legend{font-weight:600;padding-right:12px}.audience-members{display:flex;gap:12px;flex-wrap:wrap}.audience-members label{display:flex;align-items:center;gap:6px}.task-audience>button{justify-self:start}.task-audience p[role=alert]{color:#b42e28}.task-audience input[type=checkbox]{accent-color:var(--vp-c-brand-1)}
</style>
