import { createClient, type SupabaseClient } from '@supabase/supabase-js'

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
    throw new Error('Supabase 公开配置缺失，请设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_PUBLISHABLE_KEY')
  }
  return supabase
}
