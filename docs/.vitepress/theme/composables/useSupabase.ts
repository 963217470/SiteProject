import { ref, onMounted } from 'vue'
import { requireSupabase, supabase } from '../lib/supabase'

export { supabase }

// 用户状态
const user = ref(null)
const profile = ref(null)
const isLoading = ref(true)

export function useAuth() {
  // 获取当前用户
  async function getUser() {
    try {
      const client = requireSupabase()
      const { data: { user: authUser } } = await client.auth.getUser()
      user.value = authUser

      if (authUser) {
        await getProfile(authUser.id)
      }
    } catch (error) {
      console.error('获取用户失败:', error)
    } finally {
      isLoading.value = false
    }
  }

  // 获取用户资料
  async function getProfile(userId: string) {
    try {
      const { data, error } = await requireSupabase()
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) throw error
      profile.value = data
    } catch (error) {
      console.error('获取用户资料失败:', error)
    }
  }

  // GitHub 登录
  async function loginWithGitHub() {
    try {
      const { error } = await requireSupabase().auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: window.location.origin
        }
      })
      if (error) throw error
    } catch (error) {
      console.error('登录失败:', error)
      throw error
    }
  }

  // 退出登录
  async function logout() {
    try {
      const { error } = await requireSupabase().auth.signOut()
      if (error) throw error
      user.value = null
      profile.value = null
    } catch (error) {
      console.error('退出失败:', error)
      throw error
    }
  }

  // 检查是否已登录
  function isLoggedIn() {
    return !!user.value
  }

  // 检查是否是管理员
  function isAdmin() {
    return profile.value?.role === 'admin'
  }

  // 检查是否是社员
  function isMember() {
    return profile.value?.role === 'member' || profile.value?.role === 'admin'
  }

  // 初始化
  onMounted(() => {
    getUser()

    // 监听登录状态变化
    if (!supabase) return
    supabase.auth.onAuthStateChange((event, session) => {
      user.value = session?.user || null
      if (session?.user) {
        getProfile(session.user.id)
      } else {
        profile.value = null
      }
    })
  })

  return {
    user,
    profile,
    isLoading,
    loginWithGitHub,
    logout,
    isLoggedIn,
    isAdmin,
    isMember,
    getProfile
  }
}
