export const adminNavigation=[
  {id:'overview',label:'管理总览',href:'/admin/'},
  {id:'articles',label:'文章审核',href:'/admin/articles'},
  {id:'comments',label:'评论审核',href:'/admin/comments/'},
  {id:'catalog',label:'游戏/工具审核',href:'/games-tools/?scope=review'},
  {id:'profiles',label:'个人信息审核',href:'/admin/profile-review'},
  {id:'knowledge',label:'知识库管理',href:'/admin/kb'},
  {id:'tasks',label:'任务管理',href:'/admin/tasks'},
  {id:'shop',label:'商城管理',href:'/admin/shop/'},
  {id:'proofs',label:'证明审核',href:'/admin/tasks?view=reviews'},
  {id:'people',label:'用户与经验',href:'/admin/tasks?view=people'}
]
export function adminSection(href){
  const url=new URL(href,'https://local.invalid')
  const path=url.pathname.replace(/\.html$/,'').replace(/\/index$/,'').replace(/\/+$/,'')
  if(path==='/admin')return 'overview'
  if(path==='/admin/shop')return 'shop'
  if(path==='/admin/tasks')return ({reviews:'proofs',people:'people',levels:'people'})[url.searchParams.get('view')]||'tasks'
  if(path==='/games-tools'&&url.searchParams.get('scope')==='review')return 'catalog'
  return ({'/admin/articles':'articles','/admin/comments':'comments','/admin/profile-review':'profiles','/admin/kb':'knowledge'})[path]||''
}
