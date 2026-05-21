-- 设置 Ce1este 用户为管理员
-- 请在 Supabase SQL Editor 中执行此脚本

-- 1. 首先查询 Ce1este 用户的信息
SELECT id, email, raw_user_meta_data
FROM auth.users
WHERE 
  email ILIKE '%ce1este%' 
  OR raw_user_meta_data->>'user_name' ILIKE '%ce1este%'
  OR raw_user_meta_data->>'full_name' ILIKE '%ce1este%';

-- 2. 获取用户ID后，执行下面的语句（替换 YOUR_USER_ID 为实际ID）
-- INSERT INTO profiles (id, role)
-- VALUES ('YOUR_USER_ID', 'admin')
-- ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- 3. 如果profiles表不存在，先创建
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'member', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 禁用 articles 表的 RLS（临时解决方案，用于测试）
ALTER TABLE articles DISABLE ROW LEVEL SECURITY;

-- 5. 为所有现有用户设置默认profile（role为user）
INSERT INTO profiles (id, role)
SELECT id, 'user'
FROM auth.users
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.users.id);

-- 6. 再次运行查询，获取Ce1este的ID
-- 然后手动执行：
-- UPDATE profiles SET role = 'admin' WHERE id = 'Ce1este的实际ID';
