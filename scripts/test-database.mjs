import { spawnSync } from 'node:child_process'
import { basename, resolve } from 'node:path'

const projectRoot = resolve(import.meta.dirname, '..')

const tests = [
  'supabase/tests/profiles_baseline.sql',
  'supabase/tests/articles_baseline.sql',
  'supabase/tests/article_interactions_baseline.sql',
  'supabase/tests/atomic_interaction_counts.sql',
  'supabase/tests/knowledge_base.sql',
  'supabase/tests/internal_resources.sql',
  'supabase/tests/profile_review.sql',
  'supabase/tests/security_hardening.sql'
]

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false
  })

  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

if (process.platform === 'win32') {
  run(process.env.ComSpec || 'cmd.exe', [
    '/d', '/s', '/c',
    'npx.cmd --yes supabase db reset --local --no-seed'
  ])
} else {
  run('npx', ['--yes', 'supabase', 'db', 'reset', '--local', '--no-seed'])
}

for (const relativePath of tests) {
  const target = `/tmp/${basename(relativePath)}`
  run('docker', ['cp', relativePath, `supabase_db_SiteProject:${target}`])
  run('docker', [
    'exec',
    'supabase_db_SiteProject',
    'psql',
    '-U', 'postgres',
    '-d', 'postgres',
    '-v', 'ON_ERROR_STOP=1',
    '-f', target
  ])
}

console.log(`Database reset and ${tests.length} test files passed.`)
