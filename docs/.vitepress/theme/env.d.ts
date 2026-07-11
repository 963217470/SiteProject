/// <reference types="vite/client" />

import type { SupabaseClient } from '@supabase/supabase-js'

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
  readonly VITE_SUPABASE_ANON_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare global {
  interface Window {
    __supabase?: SupabaseClient
  }
}

export {}
