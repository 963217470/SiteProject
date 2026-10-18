import assert from 'node:assert/strict'
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'
import { createReadStream, createWriteStream } from 'node:fs'
import { appendFile, open, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const magic = Buffer.from('RDBACKUP1'), headerSize = magic.length + 12
export async function cryptBackup(mode, source, destination, keyPath) {
  assert(['encrypt', 'decrypt'].includes(mode), 'Invalid encryption mode')
  assert.notEqual(resolve(source), resolve(destination), 'Source and destination must differ')
  const key = await readFile(keyPath)
  assert.equal(key.length, 32, 'Backup key must contain exactly 32 bytes')
  try { await stat(destination); throw new Error('Destination already exists') } catch (error) { if (error.code !== 'ENOENT') throw error }
  const temporary = destination + '.' + randomBytes(8).toString('hex') + '.partial'
  try {
    if (mode === 'encrypt') {
      const header = Buffer.concat([magic, randomBytes(12)]), cipher = createCipheriv('aes-256-gcm', key, header.subarray(magic.length))
      cipher.setAAD(header)
      await writeFile(temporary, header, { mode: 0o600, flag: 'wx' })
      await pipeline(createReadStream(source), cipher, createWriteStream(temporary, { flags: 'a', mode: 0o600 }))
      await appendFile(temporary, cipher.getAuthTag())
    } else {
      const size = (await stat(source)).size
      assert(size > headerSize + 16, 'Encrypted backup is truncated')
      const file = await open(source, 'r'), header = Buffer.alloc(headerSize), tag = Buffer.alloc(16)
      try { await file.read(header, 0, header.length, 0); await file.read(tag, 0, 16, size - 16) } finally { await file.close() }
      assert(header.subarray(0, magic.length).equals(magic), 'Invalid backup format')
      const decipher = createDecipheriv('aes-256-gcm', key, header.subarray(magic.length))
      decipher.setAAD(header); decipher.setAuthTag(tag)
      await pipeline(createReadStream(source, { start: headerSize, end: size - 17 }), decipher, createWriteStream(temporary, { flags: 'wx', mode: 0o600 }))
    }
    await rename(temporary, destination)
  } catch (error) { await unlink(temporary).catch(() => {}); throw error }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [mode, source, destination, key] = process.argv.slice(2)
  assert(source && destination && key, 'Usage: backup-crypto.mjs encrypt|decrypt SOURCE DESTINATION KEY_FILE')
  await cryptBackup(mode, source, destination, key)
  console.log('Encrypted backup operation completed')
}
