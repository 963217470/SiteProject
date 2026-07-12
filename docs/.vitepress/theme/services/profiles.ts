import { requireSupabase } from '../lib/supabase'
import type { Database } from '../types/database'
import { AppError } from '../lib/errors'
import { derivePermissions } from '../lib/permissions'

export type Profile = Database['public']['Tables']['profiles']['Row']
export type ProfileChange = Database['public']['Tables']['profile_changes']['Row']
export type ProfileChangeInsert = Database['public']['Tables']['profile_changes']['Insert']
export type ProfileChangeStatus = ProfileChange['status']

const profileFields = 'id, username, full_name, avatar_url, bio, role, created_at, updated_at' as const
const profileChangeFields = 'id, user_id, username, avatar_url, bio, status, review_note, reviewed_by, reviewed_at, created_at, updated_at' as const

export async function getProfile(userId: string) {
  const result = await requireSupabase()
    .from('profiles')
    .select(profileFields)
    .eq('id', userId)
    .maybeSingle()
  if (result.error) throw result.error
  return result.data
}

export async function getProfiles(userIds: string[]) {
  const ids = Array.from(new Set(userIds.filter(Boolean)))
  if (!ids.length) return []
  const result = await requireSupabase().from('profiles').select(profileFields).in('id', ids)
  if (result.error) throw result.error
  return result.data || []
}

export async function requireAdminProfile(userId: string) {
  const profile = await getProfile(userId)
  if (!profile || !derivePermissions(profile.role).isAdmin) throw new AppError('forbidden')
  return profile
}

export async function getPendingProfileChanges(userId: string) {
  const result = await requireSupabase()
    .from('profile_changes')
    .select(profileChangeFields)
    .eq('user_id', userId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
  if (result.error) throw result.error
  return result.data || []
}

export async function submitProfileChange(change: ProfileChangeInsert) {
  const result = await requireSupabase().from('profile_changes').insert(change).select(profileChangeFields).single()
  if (result.error) throw result.error
  return result.data
}

export async function listProfileChanges(status?: ProfileChangeStatus) {
  let query = requireSupabase().from('profile_changes').select(profileChangeFields).order('created_at', { ascending: false })
  if (status) query = query.eq('status', status)
  const result = await query
  if (result.error) throw result.error
  return result.data || []
}

export async function reviewProfileChange(changeId: string, decision: 'approved' | 'rejected', reviewNote?: string) {
  const result = await requireSupabase().rpc('review_profile_change', {
    p_change_id: changeId,
    p_decision: decision,
    p_review_note: reviewNote || undefined
  })
  if (result.error) throw result.error
  return result.data
}
