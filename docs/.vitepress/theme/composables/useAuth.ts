import type { AuthChangeEvent, Session, Subscription, User } from '@supabase/supabase-js'
import { computed, readonly, shallowRef } from 'vue'
import { requireSupabase, supabase } from '../lib/supabase'
import { type AppError, toAppError } from '../lib/errors'
import { getProfile, type Profile } from '../services/profiles'

export type UserProfile = Profile

const session = shallowRef<Session | null>(null)
const user = shallowRef<User | null>(null)
const profile = shallowRef<UserProfile | null>(null)
const loading = shallowRef(Boolean(supabase))
const error = shallowRef<AppError | null>(null)
const initialized = shallowRef(false)

let initialization: Promise<void> | null = null
let subscription: Subscription | null = null

async function loadProfile(userId: string) {
  profile.value = await getProfile(userId)
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
      error.value = toAppError(reason)
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
      error.value = toAppError(reason, 'auth')
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
    error.value = toAppError(result.error, 'auth')
    throw error.value
  }
}

export async function logout() {
  error.value = null
  const result = await requireSupabase().auth.signOut()
  if (result.error) {
    error.value = toAppError(result.error, 'auth')
    throw error.value
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
