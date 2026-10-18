import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createReadStream, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { cryptBackup } from './backup-crypto.mjs'
import { verifyInventory } from './data-inventory.mjs'

const [source, key] = process.argv.slice(2)
assert(source && key, 'Usage: verify-encrypted-backup.mjs ENCRYPTED_ARCHIVE KEY_FILE')
const hash = createHash('sha256')
for await (const chunk of createReadStream(source)) hash.update(chunk)
const expected = readFileSync(source + '.sha256', 'utf8').trim().split(/\s+/)[0]
assert.equal(hash.digest('hex'), expected, 'Encrypted archive checksum mismatch')
const work = mkdtempSync(join(dirname(resolve(source)), '.rd-backup-verify-'))
try {
  const archive = join(work, 'export.tar')
  await cryptBackup('decrypt', source, archive, key)
  execFileSync('tar', ['-xf', archive, '-C', work, './data.tgz', './data-inventory.json'])
  const entries = execFileSync('tar', ['-tzf', join(work, 'data.tgz')], { encoding: 'utf8' }).trim().split(/\r?\n/)
  assert(entries.every(name => /^var\/lib\/rd-studio(?:\/|$)/.test(name) && !name.split('/').includes('..') && !name.includes('\\')), 'Unsafe archive path')
  execFileSync('tar', ['-xzf', join(work, 'data.tgz'), '-C', work])
  verifyInventory(join(work, 'var/lib/rd-studio'), JSON.parse(readFileSync(join(work, 'data-inventory.json'), 'utf8')))
  console.log('Local encrypted checksum, authenticated decryption and restored database/file inventory verified')
} finally { rmSync(work, { recursive: true, force: true }) }
