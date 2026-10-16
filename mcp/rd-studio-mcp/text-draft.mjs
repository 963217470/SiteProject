export function importTextDraft(notes, user, input) {
  const text = input.text.replace(/\r\n?/g, '\n')
  if (!text.trim()) throw Object.assign(new Error('导入文本不能为空'), { status: 400 })
  // Plain text must not accidentally become HTML, Markdown links or formulas.
  const markdown = input.format === 'markdown' ? text : text.split('\n').map(line => line
    .replace(/[!-/:-@\[-`{-~]/g, character => '&#' + character.charCodeAt(0) + ';')
    .replace(/^[ \t]+/, whitespace => [...whitespace].map(character => character === '\t' ? '&#9;' : '&#32;').join(''))
    + (line.trim() ? '  ' : '')).join('\n')
  if (markdown.length > 2000000) throw Object.assign(new Error('转换后的正文超过 200 万字符，请拆分导入'), { status: 400 })
  const title = input.title?.trim() || text.split('\n').find(line => line.trim()).trim().slice(0, 300)
  const saved = notes.saveDraft(user, { ...input, title, markdown })
  return { ...saved, imported_format: input.format, source_characters: text.length }
}
