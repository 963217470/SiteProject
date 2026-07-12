const REDIRECT_KEY = 'redirectAfterLogin'

export function sanitizeRedirectPath(value: unknown, fallback = '/') {
  if (typeof value !== 'string') return fallback
  const candidate = value.trim()

  if (!candidate.startsWith('/') || candidate.startsWith('//') || candidate.includes('\\') || /[\u0000-\u001f]/.test(candidate)) {
    return fallback
  }

  try {
    const base = new URL('https://rd-studio.invalid/')
    const parsed = new URL(candidate, base)
    if (parsed.origin !== base.origin) return fallback
    if (parsed.pathname === '/auth/callback' || parsed.pathname === '/login') return fallback
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallback
  }
}

export function rememberLoginRedirect(value: unknown) {
  if (typeof window === 'undefined') return '/'
  const path = sanitizeRedirectPath(value)
  window.localStorage.setItem(REDIRECT_KEY, path)
  return path
}

export function takeLoginRedirect() {
  if (typeof window === 'undefined') return '/'
  const path = sanitizeRedirectPath(window.localStorage.getItem(REDIRECT_KEY))
  window.localStorage.removeItem(REDIRECT_KEY)
  return path
}
