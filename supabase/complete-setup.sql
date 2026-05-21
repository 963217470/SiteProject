-- 完整的数据库设置脚本
-- 请在 Supabase SQL Editor 中执行此脚本

-- 1. 首先检查 profiles 表是否存在，如果不存在则创建
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user' CHECK (role IN ('user', 'member', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 确保 RLS 已启用
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. 创建 profiles 表的策略
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

CREATE POLICY "Anyone can view profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can update all profiles" ON profiles FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- 4. 将 Ce1este 用户设置为管理员
-- 注意：您需要将 'YOUR_USER_ID_HERE' 替换为 Ce1este 用户的实际 UUID
-- 可以通过 SELECT id FROM auth.users WHERE email = 'Ce1este的邮箱' 来获取

-- 方法1：如果您知道 Ce1este 的用户ID，直接替换下面的 'USER_ID'
INSERT INTO profiles (id, role)
VALUES ('USER_ID', 'admin')
ON CONFLICT (id) DO UPDATE SET role = 'admin';

-- 方法2：如果您不确定用户ID，可以先查询
-- SELECT id, email FROM auth.users WHERE email LIKE '%Ce1este%' OR email LIKE '%ce1este%';

-- 5. 为新注册用户自动创建 profile 的触发器
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'user_name',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 删除旧触发器（如果存在）
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 创建新触发器
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. 再次修复 articles 表的 RLS 策略（完全重置）
ALTER TABLE articles DISABLE ROW LEVEL SECURITY;

-- 7. 验证设置
SELECT 'Profiles table created' AS status;
SELECT * FROM profiles ORDER BY created_at DESC LIMIT 10;
