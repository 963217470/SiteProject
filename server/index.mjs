import { resolve, join } from 'node:path'
import { openDatabase } from './database.mjs'
import { createApp } from './app.mjs'
import { startTaskScheduler } from './task-scheduler.mjs'

const production = process.env.NODE_ENV === 'production'
const siteUrl = new URL(process.env.SITE_URL || 'http://localhost:3100').origin
const sessionSecret = process.env.SESSION_SECRET
if (!sessionSecret || sessionSecret.length < 32 || sessionSecret.includes('replace-with')) throw new Error('Configure a random SESSION_SECRET of at least 32 characters')
if (production && !siteUrl.startsWith('https://')) throw new Error('Production SITE_URL must use HTTPS')
const dataDir = resolve(process.env.DATA_DIR || './data')
const maxUploadMb = Number(process.env.MAX_UPLOAD_MB || 100)
if (!Number.isInteger(maxUploadMb) || maxUploadMb < 1 || maxUploadMb > 500) throw new Error('Invalid MAX_UPLOAD_MB')
const db = openDatabase(join(dataDir, 'site.sqlite'))
const app = createApp(db, {
  siteUrl, sessionSecret, production, dataDir, maxUploadMb,
  githubClientId: process.env.GITHUB_CLIENT_ID,
  githubClientSecret: process.env.GITHUB_CLIENT_SECRET,
  adminGithubIds: (process.env.ADMIN_GITHUB_IDS || '').split(',').map(value => value.trim()).filter(Boolean)
})
const server = app.listen(Number(process.env.PORT || 3100), process.env.HOST || '127.0.0.1', () => console.log('RD STUDIO API listening'))
const stopTaskScheduler=startTaskScheduler(app.locals.publishDueTasks)
function shutdown() { stopTaskScheduler();server.close(() => { db.close(); process.exit(0) }) }
process.on('SIGTERM', shutdown)
process.on('SIGINT', shutdown)
