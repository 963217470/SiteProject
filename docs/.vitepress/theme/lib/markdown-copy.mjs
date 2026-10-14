export function copyMarkdownSelection(event) {
  const root = event.currentTarget
  const selection = root.ownerDocument.getSelection()
  if (!event.clipboardData || !selection?.rangeCount || selection.isCollapsed) return
  const range = selection.getRangeAt(0)
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return
  const container = root.ownerDocument.createElement('div')
  container.append(range.cloneContents())
  // A selection wholly inside a formula expands to its original TeX exactly once.
  const element = range.commonAncestorContainer.nodeType === 1 ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement
  const formula = element?.closest('.rd-math')
  if (formula && root.contains(formula)) container.replaceChildren(formula.cloneNode(true))
  const formulas = container.querySelectorAll('.rd-math')
  if (!formulas.length) return
  formulas.forEach(el => {
    const delimiter = el.dataset.display === 'true' ? '$$' : '$'
    el.replaceWith(root.ownerDocument.createTextNode(delimiter + el.dataset.tex + delimiter))
  })
  container.querySelectorAll('p,div,pre,blockquote,li,h1,h2,h3,h4,h5,h6,tr').forEach(el => el.append('\n'))
  container.querySelectorAll('br').forEach(el => el.replaceWith('\n'))
  event.clipboardData.setData('text/plain', container.textContent.trim())
  event.clipboardData.setData('text/html', container.innerHTML)
  event.preventDefault()
}
