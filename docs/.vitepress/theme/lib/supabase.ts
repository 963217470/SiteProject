import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { AppError } from './errors'

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || '').trim()
const supabasePublicKey = String(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
    || import.meta.env.VITE_SUPABASE_ANON_KEY
    || ''
).trim()

export const isSupabaseConfigured = Boolean(supabaseUrl && supabasePublicKey)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublicKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      }
    })
  : null

export function requireSupabase(): SupabaseClient {
  if (!supabase) {
    throw new AppError('config')
  }
  return supabase
}
