// Local preview fixtures only; never run against the production database.
import { DatabaseSync } from 'node:sqlite'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

const db = new DatabaseSync(join(tmpdir(), 'rd-studio-ui-preview-data', 'site.sqlite'))
db.exec('PRAGMA foreign_keys = ON; BEGIN')
db.prepare('INSERT OR IGNORE INTO users(id,github_id,github_username) VALUES(?,?,?)').run('ui-preview', 'ui-preview', 'UI Preview')
db.prepare('INSERT OR IGNORE INTO profiles(id,username) VALUES(?,?)').run('ui-preview', '本地预览')
db.prepare('INSERT OR IGNORE INTO knowledge_branches(id,name,slug,description) VALUES(?,?,?,?)').run('ui-preview-programming', '程序', 'ui-preview-programming', '本地布局测试数据，不会发布到服务器。')
const titles = ['Unity 2D 光照系统入门', '从零搭建游戏角色控制器', 'Game Jam 项目复盘', '技术美术：材质与光照', 'Godot 场景与节点笔记']
const insert = db.prepare('INSERT OR IGNORE INTO articles(id,title,summary,content,cover_url,tags,status,author_id,kb_enabled,kb_branch_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)')
for (let i = 0; i < 15; i++) insert.run(`ui-preview-${i}`, titles[i % titles.length] + (i > 4 ? ` · ${i + 1}` : ''), '本地 UI 测试笔记：整理游戏开发中的实践、思考与学习路线。', '# 本地预览\n\n这些数据仅用于检查布局与交互。', i % 3 === 0 ? '/images/hero-bg.jpg' : null, JSON.stringify([i % 2 ? 'Unity' : 'Godot', '开发笔记']), 'published', 'ui-preview', 1, 'ui-preview-programming', `2026-10-${String(i + 1).padStart(2, '0')}T00:00:00Z`)
db.exec('COMMIT')
db.close()
console.log('Local-only UI preview fixtures ready')
