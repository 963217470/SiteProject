import { randomUUID } from 'node:crypto'
import {adminAudit} from './admin-audit.mjs'
import { formalMember } from './experience.mjs'
import { firstArticleImage } from './article-cover.mjs'

const tables = new Set(['profiles', 'articles', 'article_likes', 'article_favorites', 'comments',
  'knowledge_branches', 'knowledge_branch_requests', 'profile_changes', 'internal_resources'])
const counters = new Set(['likes_count', 'comments_count', 'views_count'])
const editable = {
  profiles: ['username', 'full_name', 'avatar_url', 'bio', 'role'],
  articles: ['title', 'summary', 'content', 'cover_url', 'tags', 'visibility', 'status', 'reject_reason',
    'kb_enabled', 'kb_branch_id', 'kb_sort_order', 'published_at', 'updated_at'],
  comments: ['content'],
  knowledge_branches: ['parent_id', 'name', 'slug', 'description', 'sort_order', 'updated_at'],
  knowledge_branch_requests: ['status', 'review_note', 'reviewed_by', 'reviewed_at', 'updated_at'],
  profile_changes: ['status', 'review_note', 'reviewed_by', 'reviewed_at'],
  internal_resources: ['title', 'description', 'category', 'version', 'file_url', 'file_path',
    'file_name', 'file_size', 'status', 'updated_at']
}

export function fail(status, message) { throw Object.assign(new Error(message), { status }) }
export function member(user) { return user && ['member', 'admin'].includes(user.role) }

function visibleArticles(user, alias, args, db) {
  if (user?.role === 'admin') return '1=1'
  const internal = formalMember(db,user)
  let sql = `(${alias}.status='published' AND (${alias}.visibility='public'${internal ? " OR " + alias + ".visibility='internal'" : ''}))`
  if (user) { args.push(user.id); sql = `(${sql} OR (${alias}.author_id=?${internal ? '' : " AND " + alias + ".visibility='public'"}))` }
  return sql
}

function scope(table, user, action, args, db) {
  const admin = user?.role === 'admin'
  if (action !== 'read' && !user) fail(401, '请先登录')
  if (table === 'knowledge_branches') {
    if (action === 'read' || admin) return '1=1'
    if (action === 'delete') { args.push(user.id); return 't.created_by=?' }
    fail(403, '需要管理员权限')
  }
  if (table === 'articles') {
    if (action === 'read') return visibleArticles(user, 't', args, db)
    if (admin) return '1=1'
    args.push(user.id)
    return "t.author_id=?" + (formalMember(db,user) ? '' : " AND t.visibility='public'")
  }
  if (['comments', 'article_likes', 'article_favorites'].includes(table)) {
    const articleScope = visibleArticles(user, 'a', args, db)
    let sql = `EXISTS(SELECT 1 FROM articles a WHERE a.id=t.article_id AND ${articleScope})`
    if (table === 'comments' && !admin) {
      args.push(user?.id || '')
      sql += " AND (t.status='approved' OR t.user_id=?) AND (t.parent_id IS NULL OR EXISTS(SELECT 1 FROM comments c WHERE c.id=t.parent_id AND c.status='approved'))"
    }
    if (table === 'article_favorites' || action !== 'read') {
      if (!user) return '0=1'
      if (!(admin && table === 'comments')) { args.push(user.id); sql += ' AND t.user_id=?' }
    }
    return sql
  }
  if (table === 'internal_resources') {
    if (action !== 'read' && !admin) fail(403, '需要管理员权限')
    return admin ? '1=1' : formalMember(db,user) ? "t.status='published'" : '0=1'
  }
  if (['profile_changes', 'knowledge_branch_requests'].includes(table)) {
    if (action !== 'read' && !admin) fail(403, '需要管理员权限')
    if (admin) return '1=1'
    if (!user) return '0=1'
    args.push(user.id)
    return `t.${table === 'profile_changes' ? 'user_id' : 'requester_id'}=?`
  }
  if (action !== 'read' && !admin) fail(403, '需要管理员权限')
  return '1=1'
}

export class Repository {
  constructor(db) { this.db = db }
  columns(table) {
    if (!tables.has(table)) fail(404, '接口不存在')
    return new Set(this.db.prepare(`PRAGMA table_info("${table}")`).all().map(row => row.name))
  }
  query(table, query, user, action = 'read', countOnly = false) {
    const columns = this.columns(table)
    const args = []
    const conditions = [scope(table, user, action, args, this.db)]
    let filterCount = 0
    for (const [column, raw] of Object.entries(query)) {
      if (['select', 'order', 'limit', 'offset'].includes(column)) continue
      if (!columns.has(column) || typeof raw !== 'string') fail(400, '无效的筛选字段')
      const dot = raw.indexOf('.')
      const operator = raw.slice(0, dot)
      let value = raw.slice(dot + 1)
      if (operator === 'in' && value.startsWith('(') && value.endsWith(')')) {
        const values = value.slice(1, -1).split(',').filter(Boolean)
        if (values.length > 1000) fail(400, '筛选值过多')
        if (!values.length) { conditions.push('0=1'); continue }
        conditions.push(`t."${column}" IN (${values.map(() => '?').join(',')})`)
        args.push(...values)
      } else {
        const operators = { eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=', like: 'LIKE' }
        if (!operators[operator]) fail(400, '无效的筛选条件')
        if (column === 'kb_enabled') value = value === 'true' ? 1 : value === 'false' ? 0 : value
        conditions.push(`t."${column}" ${operators[operator]} ?`)
        args.push(value)
      }
      filterCount++
    }
    if (action !== 'read' && !filterCount) fail(400, '修改必须指定筛选条件')
    let sql = `SELECT ${countOnly ? 'COUNT(*) AS count' : 't.*'} FROM "${table}" t WHERE ${conditions.join(' AND ')}`
    if (query.order) {
      const [column, direction] = query.order.split('.')
      if (!columns.has(column) || !['asc', 'desc'].includes(direction)) fail(400, '无效的排序')
      sql += ` ORDER BY t."${column}" ${direction.toUpperCase()}`
    }
    if (action === 'read' && !countOnly) {
      const limit = query.limit === undefined ? 1000 : Number(query.limit)
      const offset = Number(query.offset || 0)
      if (!Number.isInteger(limit) || limit < 0 || limit > 1000 || !Number.isInteger(offset) || offset < 0) fail(400, '无效的分页')
      sql += ' LIMIT ? OFFSET ?'
      args.push(limit, offset)
    }
    return countOnly ? this.db.prepare(sql).get(...args).count : this.db.prepare(sql).all(...args)
  }
  project(table, rows, select = '*') {
    const columns = this.columns(table)
    // Author embeds expose only explicitly supported public profile fields.
    const embedded = /(?:,\s*)?profiles!articles_author_id_fkey\(username(,\s*avatar_url)?\)/
    const joinAuthor = table === 'articles' && embedded.test(select)
    const authorAvatar = joinAuthor && Boolean(select.match(embedded)[1])
    const flat = select.replace(embedded, '').trim()
    const fields = flat === '*' ? [...columns] : flat.split(',').map(field => field.trim()).filter(Boolean)
    if (!fields.length || fields.some(field => !columns.has(field) && !(table === 'articles' && field === 'first_image_url'))) fail(400, '无效的返回字段')
    return rows.map(row => {
      const result = Object.fromEntries(fields.map(field => [field, row[field]]))
      if (fields.includes('first_image_url')) result.first_image_url = firstArticleImage(row.content)
      if ('tags' in result) result.tags = JSON.parse(result.tags)
      if ('kb_enabled' in result) result.kb_enabled = Boolean(result.kb_enabled)
      if (joinAuthor) result.profiles = this.db.prepare(authorAvatar ? 'SELECT username,avatar_url FROM profiles WHERE id=?' : 'SELECT username FROM profiles WHERE id=?').get(row.author_id) || null
      return result
    })
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE')
    try { const result = fn(); this.onCommit?.(); this.db.exec('COMMIT'); return result }
    catch (error) { this.db.exec('ROLLBACK'); throw error }
  }
  encode(table, body) {
    const columns = this.columns(table)
    const result = {}
    for (const [key, value] of Object.entries(body)) {
      if (!columns.has(key)) fail(400, '无效的数据字段：' + key)
      if (key === 'tags') {
        if (!Array.isArray(value) || value.length > 50 || value.some(tag => typeof tag !== 'string' || tag.length > 100)) fail(400, '无效的标签')
        result[key] = JSON.stringify(value)
      } else if (key === 'kb_enabled') {
        if (typeof value !== 'boolean') fail(400, '无效的知识库选项')
        result[key] = Number(value)
      } else {
        if (value !== null && !['string', 'number'].includes(typeof value)) fail(400, '无效的数据类型')
        if (typeof value === 'string' && value.length > (key === 'content' ? 2000000 : 10000)) fail(400, '内容过长')
        if (['avatar_url', 'cover_url', 'file_url'].includes(key) && value && !/^https:\/\/|^\/api\/files\//.test(value)) fail(400, '无效的文件地址')
        result[key] = value
      }
    }
    return result
  }
  visibleArticle(id, user) { return this.query('articles', { id: 'eq.' + id }, user)[0] }
  applyProfileChange(row, at) {
    const fields = ['username', 'avatar_url', 'bio'].filter(key => row[key] !== null && row[key] !== undefined && (key !== 'avatar_url' || row[key]))
    if (!fields.length) fail(400, '没有可更新的资料')
    if (fields.includes('username') && !row.username.trim()) fail(400, '昵称不能为空')
    const result = this.db.prepare(`UPDATE profiles SET ${fields.map(key => key + '=?').join(',')},updated_at=? WHERE id=?`).run(...fields.map(key => row[key]), at, row.user_id)
    if (!result.changes) fail(404, '用户资料不存在')
  }
  deleteBranch(row) {
    const children=this.db.prepare('SELECT id,slug FROM knowledge_branches WHERE parent_id=?').all(row.id)
    if (children.some(child=>this.db.prepare('SELECT 1 FROM knowledge_branches WHERE parent_id IS ? AND slug=? AND id<>?').get(row.parent_id,child.slug,row.id))) fail(409,'上一级已有同名分支，请先调整子分支再删除')
    this.db.prepare('UPDATE knowledge_branches SET parent_id=? WHERE parent_id=?').run(row.parent_id,row.id)
    this.db.prepare('UPDATE articles SET kb_branch_id=? WHERE kb_branch_id=?').run(row.parent_id,row.id)
    this.db.prepare('DELETE FROM knowledge_branches WHERE id=?').run(row.id)
  }
  insert(table, input, user) {
    if (table === 'comments') fail(403, '请使用评论审核接口')
    if (!user) fail(401, '请先登录')
    if (!input || Array.isArray(input) || typeof input !== 'object') fail(400, '无效的数据')
    const data = this.encode(table, input)
    const createFields = table === 'profile_changes' ? ['username', 'avatar_url', 'bio', 'status']
      : table === 'knowledge_branch_requests' ? ['requested_path', 'requested_description', 'status'] : editable[table] || []
    const allowed = new Set([...createFields, 'article_id', 'user_id', 'requester_id', 'author_id', 'created_by'])
    if (Object.keys(data).some(key => !allowed.has(key))) fail(400, '禁止设置该字段')
    if (table === 'articles') {
      delete data.reject_reason
      delete data.published_at
      delete data.updated_at
      delete data.kb_sort_order
      data.author_id = user.id
      data.status = data.status === 'draft' ? 'draft' : 'pending'
      if (data.visibility === 'internal' && !formalMember(this.db,user)) fail(403, '需要正式社员权限')
    } else if (['comments', 'article_likes', 'article_favorites'].includes(table)) {
      if (!this.visibleArticle(data.article_id, user)) fail(404, '文章不存在')
      data.user_id = user.id
    } else if (table === 'profile_changes') {
      const keys = ['username', 'avatar_url', 'bio', 'user_id', 'status']
      if (Object.keys(data).some(key => !keys.includes(key))) fail(403, '禁止设置审核字段')
      data.user_id = user.id
      data.status = 'pending'
      if(data.avatar_url){
        let path
        try{path=decodeURIComponent(new URL(data.avatar_url,'https://local.invalid').pathname)}catch{fail(400,'无效的头像地址')}
        const prefix='/api/files/avatars/'
        const file=path.startsWith(prefix)&&this.db.prepare("SELECT owner_id,mime,size FROM files WHERE bucket='avatars' AND path=?").get(path.slice(prefix.length))
        if(!file||file.owner_id!==user.id||!file.mime.startsWith('image/')||file.size>2*1024*1024)fail(400,'请选择本人上传的头像图片')
        data.avatar_url=path
      }
      if (user.role === 'admin') {
        data.status = 'approved'
        data.reviewed_by = user.id
        data.reviewed_at = new Date(this.db.prepare('SELECT rd_now() time').get().time).toISOString()
        data.review_note = '管理员本人资料免审通过'
      }
    } else if (table === 'knowledge_branch_requests') {
      if (Object.keys(data).some(key => !['article_id', 'requester_id', 'requested_path', 'requested_description', 'status'].includes(key))) fail(403, '禁止设置审核字段')
      const article = this.visibleArticle(data.article_id, user)
      if (!article || article.author_id !== user.id) fail(403, '只能为自己的文章申请分支')
      data.requester_id = user.id
      data.status = 'pending'
    } else {
      if (user.role !== 'admin') fail(403, '需要管理员权限')
      if (['knowledge_branches', 'internal_resources'].includes(table)) data.created_by = table === 'knowledge_branches' && data.created_by ? data.created_by : user.id
    }
    if (this.columns(table).has('id')) data.id = randomUUID()
    const keys = Object.keys(data)
    const conflict = ['article_likes', 'article_favorites'].includes(table) ? ' ON CONFLICT(article_id,user_id) DO NOTHING' : ''
    this.db.prepare(`INSERT INTO "${table}"(${keys.map(key => `"${key}"`).join(',')}) VALUES(${keys.map(() => '?').join(',')})${conflict}`).run(...Object.values(data))
    if (table === 'profile_changes' && data.status === 'approved') {
      this.applyProfileChange(data, data.reviewed_at)
      adminAudit(this.db,user,'资料自动通过','profile',data.id,'管理员本人资料免审通过',Date.parse(data.reviewed_at))
    }
    if(user.role==='admin'&&['articles','knowledge_branches','internal_resources'].includes(table))adminAudit(this.db,user,'创建',table,data.id,data.title||data.name||'')
    return data.id ? this.db.prepare(`SELECT * FROM "${table}" WHERE id=?`).get(data.id)
      : this.db.prepare(`SELECT * FROM "${table}" WHERE article_id=? AND user_id=?`).get(data.article_id, data.user_id)
  }
  mutate(table, method, input, query, user) {
    if (table === 'comments') fail(403, '请使用评论审核接口')
    if (table === 'knowledge_branches' && method === 'DELETE' && !query.id?.startsWith('eq.')) fail(400,'删除分支必须指定单个节点')
    const isCounter = table === 'articles' && method === 'PATCH' && input && Object.keys(input).length > 0 && Object.keys(input).every(key => counters.has(key))
    const rows = this.query(table, query, user, isCounter ? 'read' : method === 'DELETE' ? 'delete' : 'write')
    if (isCounter) {
      if (!query.id?.startsWith('eq.') || Object.keys(query).some(key => !['id', 'select', 'limit'].includes(key))) fail(400, '计数必须指定文章')
      if ('views_count' in input) this.db.prepare('UPDATE articles SET views_count=views_count+1 WHERE id=?').run(rows[0]?.id || '')
      return rows.map(row => this.db.prepare('SELECT * FROM articles WHERE id=?').get(row.id))
    }
    const data = method === 'PATCH' ? this.encode(table, input) : {}
    if (method === 'PATCH') {
      if (!Object.keys(data).length || Object.keys(data).some(key => !(editable[table] || []).includes(key))) fail(400, '禁止修改该字段')
      if (table === 'articles' && user?.role !== 'admin') {
        if ('status' in data && !['draft', 'pending'].includes(data.status)) fail(403, '发布文章需要管理员审核')
        if (['reject_reason', 'published_at', 'kb_sort_order'].some(key => key in data && data[key] !== null)) fail(403, '禁止修改审核字段')
        if (data.visibility === 'internal' && !formalMember(this.db,user)) fail(403, '需要正式社员权限')
        // Editing published content sends it back through review.
        if (Object.keys(data).some(key => ['title', 'summary', 'content', 'cover_url', 'tags', 'visibility', 'kb_enabled', 'kb_branch_id'].includes(key)) && !(data.status === 'draft' && rows.every(row => row.status === 'draft'))) data.status = 'pending'
      }
      if (['profile_changes', 'knowledge_branch_requests'].includes(table)) {
        data.reviewed_by = user.id
        data.reviewed_at = new Date().toISOString()
      }
    }
    return this.transaction(() => rows.map(row => {
      if(table==='profiles'&&row.role==='admin'&&((data.role&&data.role!=='admin')||method==='DELETE')&&this.db.prepare("SELECT count(*) n FROM profiles WHERE role='admin'").get().n<=1)fail(409,'不能移除最后一位管理员')
      if (table === 'knowledge_branches' && data.parent_id) {
        const ancestor = this.db.prepare('WITH RECURSIVE parents(id,parent_id) AS (SELECT id,parent_id FROM knowledge_branches WHERE id=? UNION SELECT k.id,k.parent_id FROM knowledge_branches k JOIN parents p ON k.id=p.parent_id) SELECT id FROM parents WHERE id=?').get(data.parent_id, row.id)
        if (ancestor) fail(400, '分支不能循环嵌套')
      }
      const identity = row.id ? 'id=?' : 'article_id=? AND user_id=?'
      const ids = row.id ? [row.id] : [row.article_id, row.user_id]
      if(user?.role==='admin'&&['articles','profiles','profile_changes','knowledge_branches','knowledge_branch_requests','internal_resources'].includes(table))adminAudit(this.db,user,method==='DELETE'?'删除':'更新',table,row.id,'role' in data?String(row.role||'')+' → '+data.role:'status' in data?String(row.status||'')+' → '+data.status:Object.keys(data).join(', '))
      if (method === 'DELETE') {
        if (table === 'knowledge_branches') {
          this.deleteBranch(row)
          return row
        }
        this.db.prepare(`DELETE FROM "${table}" WHERE ${identity}`).run(...ids)
        return row
      }
      const keys = Object.keys(data)
      this.db.prepare(`UPDATE "${table}" SET ${keys.map(key => `"${key}"=?`).join(',')} WHERE ${identity}`).run(...Object.values(data), ...ids)
      return this.db.prepare(`SELECT * FROM "${table}" WHERE ${identity}`).get(...ids)
    }))
  }
}
