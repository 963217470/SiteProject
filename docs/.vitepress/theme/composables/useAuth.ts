import type { AuthChangeEvent, Session, Subscription, User } from '@supabase/supabase-js'
import { computed, readonly, shallowRef } from 'vue'
import { requireSupabase, supabase } from '../lib/supabase'

export interface UserProfile {
  id: string
  username: string | null
  full_name: string | null
  avatar_url: string | null
  bio: string | null
  role: 'user' | 'member' | 'admin'
}

const session = shallowRef<Session | null>(null)
const user = shallowRef<User | null>(null)
const profile = shallowRef<UserProfile | null>(null)
const loading = shallowRef(Boolean(supabase))
const error = shallowRef<Error | null>(null)
const initialized = shallowRef(false)

let initialization: Promise<void> | null = null
let subscription: Subscription | null = null

function toError(value: unknown, fallback: string) {
  return value instanceof Error ? value : new Error(fallback)
}

async function loadProfile(userId: string) {
  const result = await requireSupabase()
    .from('profiles')
    .select('id, username, full_name, avatar_url, bio, role')
    .eq('id', userId)
    .maybeSingle()

  if (result.error) throw result.error
  profile.value = result.data as UserProfile | null
}

async function applySession(nextSession: Session | null) {
  session.value = nextSession
  user.value = nextSession?.user ?? null
  profile.value = null
  if (nextSession?.user) await loadProfile(nextSession.user.id)
}

function handleAuthChange(_event: AuthChangeEvent, nextSession: Session | null) {
  queueMicrotask(async () => {
    loading.value = true
    error.value = null
    try {
      await applySession(nextSession)
    } catch (reason) {
      error.value = toError(reason, '刷新用户资料失败')
    } finally {
      loading.value = false
    }
  })
}

export async function initializeAuth() {
  if (initialization) return initialization

  initialization = (async () => {
    loading.value = true
    error.value = null
    try {
      const client = requireSupabase()
      const result = await client.auth.getSession()
      if (result.error) throw result.error
      await applySession(result.data.session)

      if (!subscription) {
        subscription = client.auth.onAuthStateChange(handleAuthChange).data.subscription
      }
      initialized.value = true
    } catch (reason) {
      error.value = toError(reason, '初始化登录状态失败')
      initialized.value = false
      initialization = null
    } finally {
      loading.value = false
    }
  })()

  return initialization
}

export function disposeAuth() {
  subscription?.unsubscribe()
  subscription = null
  initialization = null
  initialized.value = false
}

export async function loginWithGitHub(redirectTo?: string) {
  error.value = null
  const callbackUrl = redirectTo || `${window.location.origin}/auth/callback`
  const result = await requireSupabase().auth.signInWithOAuth({
    provider: 'github',
    options: { redirectTo: callbackUrl }
  })
  if (result.error) {
    error.value = result.error
    throw result.error
  }
}

export async function logout() {
  error.value = null
  const result = await requireSupabase().auth.signOut()
  if (result.error) {
    error.value = result.error
    throw result.error
  }
  await applySession(null)
}

export function useAuth() {
  return {
    session: readonly(session),
    user: readonly(user),
    profile: readonly(profile),
    loading: readonly(loading),
    error: readonly(error),
    initialized: readonly(initialized),
    isLoggedIn: computed(() => Boolean(user.value)),
    initializeAuth,
    loginWithGitHub,
    logout
  }
}
