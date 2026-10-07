export async function getSupabase() {
  return typeof window === 'undefined' ? null : window.__api
}
