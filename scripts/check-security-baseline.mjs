import { readFile } from 'node:fs/promises'

const files = {
  migration: await readFile('supabase/migrations/202607100001_security_hardening.sql', 'utf8'),
  permissionTests: await readFile('supabase/tests/security_hardening.sql', 'utf8'),
  restClient: await readFile('docs/public/supabase-rest.js', 'utf8'),
  resourcesPage: await readFile('docs/internal/index.md', 'utf8')
}

const requirements = [
  ['profile role trigger', files.migration, /before update of role on public\.profiles/i],
  ['authenticated article insert', files.migration, /author_id\s*=\s*auth\.uid\(\)[\s\S]*status in \('draft', 'pending'\)/i],
  ['likes RLS', files.migration, /alter table public\.article_likes enable row level security/i],
  ['comments RLS', files.migration, /alter table public\.comments enable row level security/i],
  ['favorites RLS', files.migration, /alter table public\.article_favorites enable row level security/i],
  ['private resource bucket', files.migration, /update storage\.buckets[\s\S]*set public = false[\s\S]*where id = 'resources'/i],
  ['signed URL client', files.restClient, /createSignedUrl/],
  ['signed URL download flow', files.resourcesPage, /createSignedUrl\(item\.file_path, 60\)/],
  ['anonymous denial test', files.permissionTests, /expected anonymous article insertion to be rejected/],
  ['role escalation denial test', files.permissionTests, /expected profile role escalation to be rejected/],
  ['cross-user interaction tests', files.permissionTests, /cross-user like deletion[\s\S]*cross-user favorite deletion[\s\S]*cross-user comment deletion/]
]

const failures = requirements
  .filter(([, content, pattern]) => !pattern.test(content))
  .map(([name]) => name)

if (failures.length > 0) {
  console.error(`Security baseline check failed:\n${failures.map((name) => `- ${name}`).join('\n')}`)
  process.exitCode = 1
} else {
  console.log('Security baseline check passed.')
}
