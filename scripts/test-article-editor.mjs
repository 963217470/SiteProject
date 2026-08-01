import assert from 'node:assert/strict'
import ts from 'typescript'
import vm from 'node:vm'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../docs/.vitepress/theme/components/article-editor/articleSubmission.ts', import.meta.url), 'utf8')
const js = ts.transpileModule(source.replace(/^import .*$/gm, ''), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
}).outputText
const sandbox = { exports: {}, require() { return {} } }
vm.runInNewContext(js, sandbox)

const { buildArticleSummary, normalizeBranchPath, submitNewArticle, validateArticleDraft } = sandbox.exports
const base = { title: '标题', summary: '', content: '# 正文\n内容', visibility: 'public', kbEnabled: false, kbBranchId: '', kbBranchPath: '' }

assert.equal(validateArticleDraft({ ...base, title: ' ' }), '请输入标题')
assert.equal(validateArticleDraft({ ...base, content: ' ' }), '请输入内容')
assert.equal(validateArticleDraft({ ...base, kbEnabled: true }), '请选择已有知识库分支，或输入要申请的新分支路径')
assert.equal(validateArticleDraft({ ...base, kbEnabled: true, kbBranchId: 'branch-id' }), '')
assert.equal(validateArticleDraft({ ...base, kbEnabled: true, kbBranchPath: '知识库总览 / 程序 / C#' }), '')
assert.equal(normalizeBranchPath(' 知识库总览 / 程序 / C# '), '程序/C#')
assert.equal(buildArticleSummary('# 标题\n\n正文 **加粗**'), '标题 正文 加粗')

for (const status of ['draft', 'pending']) {
  let inserted
  const result = await submitNewArticle({
    article: { ...base },
    tags: ['测试'],
    status,
    userId: 'user-id',
    supabase: {},
    hasKnowledgeBranches: false,
    replaceInlineImages: async value => value,
    notify() {},
    create: async payload => {
      inserted = payload
      return { id: status + '-id' }
    }
  })
  assert.equal(result.ok, true)
  assert.equal(result.articleId, status + '-id')
  assert.equal(inserted.status, status)
  assert.equal(inserted.author_id, 'user-id')
}

console.log('Article editor submission tests passed.')
