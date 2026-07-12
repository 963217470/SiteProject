export type UserRole = 'user' | 'member' | 'admin'

export interface PermissionSet {
  role: UserRole
  isUser: boolean
  isMember: boolean
  isAdmin: boolean
  canCreateArticle: boolean
  canAccessInternal: boolean
  canManageContent: boolean
  canManageUsers: boolean
}

export function normalizeRole(value: unknown): UserRole {
  return value === 'admin' || value === 'member' ? value : 'user'
}

export function derivePermissions(value: unknown): PermissionSet {
  const role = normalizeRole(value)
  const isAdmin = role === 'admin'
  const isMember = role === 'member' || isAdmin

  return {
    role,
    isUser: role === 'user',
    isMember,
    isAdmin,
    canCreateArticle: isMember,
    canAccessInternal: isMember,
    canManageContent: isAdmin,
    canManageUsers: isAdmin
  }
}

export function roleLabel(value: unknown) {
  return ({ user: '普通用户', member: '社员', admin: '管理员' } as const)[normalizeRole(value)]
}

export function roleDescription(value: unknown) {
  return ({
    user: '可以维护资料、收藏内容和参与讨论',
    member: '可以发布文章、访问内部资源和参与讨论',
    admin: '拥有审核与后台管理权限'
  } as const)[normalizeRole(value)]
}
