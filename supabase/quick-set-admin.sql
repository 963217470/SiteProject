-- ======================================
-- 快速设置最近登录的用户为管理员
-- ======================================

-- 1. 先查看所有用户（请运行这个找到您的用户ID！）
SELECT 
  id AS user_id,
  email,
  raw_user_meta_data->>'user_name' AS github_username,
  raw_user_meta_data->>'full_name' AS full_name,
  last_sign_in_at
FROM auth.users
ORDER BY last_sign_in_at DESC NULLS LAST;

-- ======================================
-- 2. 找到您的用户后，复制下面的SQL并替换YOUR_USER_ID_HERE
-- ======================================

-- 创建profiles表（如果不存在）
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'member', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 设置您为管理员（替换YOUR_USER_ID_HERE）
-- 注意：先运行上面的SELECT语句找到您的user_id！
INSERT INTO profiles (id, username, full_name, avatar_url, role)
SELECT 
  id,
  COALESCE(raw_user_meta_data->>'user_name', split_part(email, '@', 1)),
  raw_user_meta_data->>'full_name',
  raw_user_meta_data->>'avatar_url',
  'admin'
FROM auth.users
WHERE id = 'YOUR_USER_ID_HERE'  -- <-- 替换成您的真实用户ID！
ON CONFLICT (id) DO UPDATE 
SET 
  role = 'admin',
  updated_at = NOW();

-- 验证设置是否成功
SELECT 
  p.id,
  p.role,
  p.username,
  p.full_name,
  u.email,
  u.last_sign_in_at
FROM profiles p
JOIN auth.users u ON p.id = u.id
WHERE p.role = 'admin';

-- ======================================
-- 备选方案：设置最后一个登录的用户为管理员（风险：可能不是您！）
-- ======================================
-- 只有在您确定要这样做时才取消注释下面的代码
/*
INSERT INTO profiles (id, username, full_name, avatar_url, role)
SELECT 
  id,
  COALESCE(raw_user_meta_data->>'user_name', split_part(email, '@', 1)),
  raw_user_meta_data->>'full_name',
  raw_user_meta_data->>'avatar_url',
  'admin'
FROM auth.users
ORDER BY last_sign_in_at DESC NULLS LAST
LIMIT 1
ON CONFLICT (id) DO UPDATE 
SET 
  role = 'admin',
  updated_at = NOW();
*/
