import { computed, type Ref } from 'vue'
import type { UserProfile } from './useAuth'
import { derivePermissions, roleDescription, roleLabel } from '../lib/permissions'

export function usePermissions(profile: Readonly<Ref<UserProfile | null>>) {
  const permissions = computed(() => derivePermissions(profile.value?.role))

  return {
    role: computed(() => permissions.value.role),
    roleLabel: computed(() => roleLabel(permissions.value.role)),
    roleDescription: computed(() => roleDescription(permissions.value.role)),
    isUser: computed(() => permissions.value.isUser),
    isMember: computed(() => permissions.value.isMember),
    isAdmin: computed(() => permissions.value.isAdmin),
    canCreateArticle: computed(() => permissions.value.canCreateArticle),
    canAccessInternal: computed(() => permissions.value.canAccessInternal),
    canManageContent: computed(() => permissions.value.canManageContent),
    canManageUsers: computed(() => permissions.value.canManageUsers)
  }
}
