export function normalizeMediaPath(path: string) {
  return String(path || '')
    .trim()
    .replace(/^["']|["']$/g, '')
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/\/+/g, '/')
}

export function isImagePath(path: string) {
  return /\.(png|jpe?g|gif|webp|svg)([?#].*)?$/i.test(normalizeMediaPath(path))
}

export function imageAltFromPath(path: string) {
  const name = normalizeMediaPath(path).split('/').pop() || 'image'
  return name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ').trim() || 'image'
}

export function createSafeFileName(name: string) {
  const ext = (String(name || '').split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg'
  const base = String(name || 'image')
    .replace(/\.[^.]+$/, '')
    .replace(/[^\w.-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'image'
  return base + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext
}

export function findImageUrl(src: string, baseDir: string, imageMap: Map<string, string>) {
  if (/^(https?:|data:|\/)/i.test(src)) return ''
  const normalizedSrc = normalizeMediaPath(src).replace(/[?#].*$/, '')
  const withBase = normalizeMediaPath((baseDir ? baseDir + '/' : '') + normalizedSrc)
  const fileName = normalizedSrc.split('/').pop()
  if (imageMap.get(withBase)) return imageMap.get(withBase) || ''
  if (imageMap.get(normalizedSrc)) return imageMap.get(normalizedSrc) || ''
  if (fileName && imageMap.get(fileName)) return imageMap.get(fileName) || ''
  for (const [key, value] of imageMap.entries()) {
    if (key.endsWith('/' + normalizedSrc) || (fileName && key.endsWith('/' + fileName))) return value
  }
  return ''
}

export function replaceRelativeImages(markdown: string, baseDir: string, imageMap: Map<string, string>) {
  return markdown
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
      const imageUrl = findImageUrl(src, baseDir, imageMap)
      return imageUrl ? '![' + (alt || imageAltFromPath(src)) + '](' + imageUrl + ')' : match
    })
    .split('\n')
    .map(line => {
      const trimmed = line.trim()
      const brokenImage = trimmed.match(/^!\[([^\]\n]*)\]?[^()\n]*\(([^)\n]+\.(?:png|jpe?g|gif|webp|svg)(?:[?#][^)]+)?)\)\s*$/i)
      if (brokenImage) {
        const imageUrl = findImageUrl(brokenImage[2], baseDir, imageMap)
        return imageUrl ? '![' + (brokenImage[1] || imageAltFromPath(brokenImage[2])) + '](' + imageUrl + ')' : line
      }
      if (isImagePath(trimmed) && !/^\s*!\[/.test(line)) {
        const imageUrl = findImageUrl(trimmed, baseDir, imageMap)
        return imageUrl ? '![' + imageAltFromPath(trimmed) + '](' + imageUrl + ')' : line
      }
      return line
    })
    .join('\n')
}
