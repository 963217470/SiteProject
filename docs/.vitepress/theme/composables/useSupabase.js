let client = null

const supabaseUrl = 'https://jenrgzwwowgfqbwcozbi.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplbnJnend3b3dnZnFid2NvemJpIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3ODgwNjM1NCwiZXhwIjoyMDk0MzgyMzU0fQ.-qioHuE8nqf-9fhwNsJmh0fPlMSt7ysc0LtFlxulh6s'

export async function getSupabase() {
  if (client) return client
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
  client = createClient(supabaseUrl, supabaseAnonKey)
  return client
}
