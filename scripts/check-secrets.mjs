import { readdir, readFile } from 'node:fs/promises'
import { execFileSync } from 'node:child_process'
import path from 'node:path'

const root = process.cwd()
const includeGenerated = process.argv.includes('--include-generated')
const ignoredDirectories = new Set([
  '.git',
  'node_modules',
  'coverage',
  '.temp'
])
if (!includeGenerated) {
  ignoredDirectories.add('dist')
  ignoredDirectories.add('cache')
}

const tokenPatterns = [
  { name: 'GitHub token', pattern: /\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g },
  { name: 'Supabase secret key', pattern: /\bsb_secret_[A-Za-z0-9_-]{20,}\b/g },
  { name: 'assigned service role key', pattern: /SUPABASE_SERVICE_ROLE_KEY[ \t]*=[ \t]*[^\s'"`]+/g },
  { name: 'private key', pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g }
]

const findings = []

try {
  const trackedFiles = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' })
    .split('\0')
    .filter(Boolean)
  for (const file of trackedFiles) {
    const name = path.basename(file)
    if ((name === '.env' || name.startsWith('.env.')) && name !== '.env.example') {
      findings.push(`${file}: tracked environment file`)
    }
  }
} catch {
  // The content scan still runs when Git metadata is unavailable.
}

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue

    const absolutePath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      await walk(absolutePath)
      continue
    }

    let content
    try {
      content = await readFile(absolutePath, 'utf8')
    } catch {
      continue
    }

    for (const { name, pattern } of tokenPatterns) {
      pattern.lastIndex = 0
      if (pattern.test(content)) findings.push(`${path.relative(root, absolutePath)}: ${name}`)
    }

    for (const match of content.matchAll(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g)) {
      try {
        const payload = JSON.parse(Buffer.from(match[0].split('.')[1], 'base64url').toString('utf8'))
        if (payload.role === 'service_role') {
          findings.push(`${path.relative(root, absolutePath)}: Supabase service_role JWT`)
        }
      } catch {
        // Ignore strings that only resemble JWTs.
      }
    }
  }
}

await walk(root)

if (findings.length > 0) {
  console.error(`Secret scan failed:\n${findings.map((finding) => `- ${finding}`).join('\n')}`)
  process.exitCode = 1
} else {
  console.log('Secret scan passed.')
}
