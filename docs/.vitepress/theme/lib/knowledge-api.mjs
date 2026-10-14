export async function knowledgeRequest(path='',options={}) {
  const response=await fetch('/api/knowledge'+path,{credentials:'same-origin',...options,
    headers:{'Content-Type':'application/json','X-RD-CSRF':'1',...options.headers}})
  const data=await response.json()
  if(!response.ok)throw new Error(data.message||'知识节点操作失败')
  return data
}
