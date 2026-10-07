import { openDatabase } from './database.mjs'
import { join } from 'node:path'
const [githubId, role] = process.argv.slice(2)
if (!/^\d+$/.test(githubId || '') || !['user', 'member', 'admin'].includes(role)) {
  throw new Error('Usage: node admin.mjs NUMERIC_GITHUB_ID user|member|admin')
}
const db = openDatabase(join(process.env.DATA_DIR || './data', 'site.sqlite'))
const result = db.prepare('UPDATE profiles SET role=?,updated_at=? WHERE id=(SELECT id FROM users WHERE github_id=?)').run(role, new Date().toISOString(), githubId)
db.close()
if (!result.changes) throw new Error('The GitHub user must sign in first')
console.log('Role updated')
