export type AppErrorKind = 'auth' | 'network' | 'forbidden' | 'validation' | 'config' | 'not_found' | 'unknown'

const messages: Record<AppErrorKind, string> = {
  auth: '登录状态已失效，请重新登录',
  network: '网络连接失败，请检查网络后重试',
  forbidden: '当前账号没有执行此操作的权限',
  validation: '提交内容不符合要求，请检查后重试',
  config: '系统配置尚未完成，请联系管理员',
  not_found: '请求的内容不存在或已被删除',
  unknown: '操作失败，请稍后重试'
}

export class AppError extends Error {
  readonly kind: AppErrorKind
  readonly userMessage: string
  readonly cause?: unknown

  constructor(kind: AppErrorKind, userMessage = messages[kind], cause?: unknown) {
    super(userMessage)
    this.name = 'AppError'
    this.kind = kind
    this.userMessage = userMessage
    this.cause = cause
  }
}

function errorText(value: unknown) {
  if (typeof value === 'string') return value
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>
    return [record.message, record.details, record.hint, record.code].filter(Boolean).join(' ')
  }
  return ''
}

export function toAppError(value: unknown, fallback: AppErrorKind = 'unknown'): AppError {
  if (value instanceof AppError) return value

  const text = errorText(value).toLowerCase()
  const code = value && typeof value === 'object' ? String((value as Record<string, unknown>).code || '') : ''

  if (code === '42501' || text.includes('permission denied') || text.includes('row-level security') || text.includes('not authorized')) {
    return new AppError('forbidden', undefined, value)
  }
  if (code === 'PGRST116' || text.includes('not found') || text.includes('does not exist')) {
    return new AppError('not_found', undefined, value)
  }
  if (text.includes('jwt') || text.includes('session') || text.includes('refresh token') || text.includes('not authenticated')) {
    return new AppError('auth', undefined, value)
  }
  if (text.includes('fetch') || text.includes('network') || text.includes('timeout') || text.includes('failed to connect')) {
    return new AppError('network', undefined, value)
  }
  if (text.includes('supabase 公开配置缺失') || text.includes('configuration')) {
    return new AppError('config', undefined, value)
  }
  if (text.includes('invalid') || text.includes('required') || text.includes('不能为空') || code === '23514' || code === '23502') {
    return new AppError('validation', undefined, value)
  }

  return new AppError(fallback, undefined, value)
}

export function toUserMessage(value: unknown, fallback: AppErrorKind = 'unknown') {
  return toAppError(value, fallback).userMessage
}
