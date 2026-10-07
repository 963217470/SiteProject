let client = null

const supabaseUrl = 'https://uulmgatzihdtbzrqaocc.supabase.co'
const supabaseAnonKey = 'sb_publishable_YV-R0fJ1Sxv7bCn1Qbvm5A_xSqdtmHf'

export async function getSupabase() {
  if (client) return client
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
  client = createClient(supabaseUrl, supabaseAnonKey)
  return client
}
