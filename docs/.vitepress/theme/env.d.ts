/// <reference types="vite/client" />

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from './types/database'
import type { derivePermissions, normalizeRole, roleDescription, roleLabel } from './lib/permissions'
import type { toAppError, toUserMessage } from './lib/errors'

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
    getSupabaseClient?: () => SupabaseClient<Database> | null
    RDPermissions?: {
      derivePermissions: typeof derivePermissions
      normalizeRole: typeof normalizeRole
      roleDescription: typeof roleDescription
      roleLabel: typeof roleLabel
    }
    RDErrors?: {
      toAppError: typeof toAppError
      toUserMessage: typeof toUserMessage
    }
  }
}

export {}
