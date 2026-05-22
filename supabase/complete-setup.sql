-- ============================================================
-- Supabase 基础设置脚本
-- ============================================================
-- 用途：
--   1. 创建 profiles 表。
--   2. 配置 profiles 的 RLS 策略。
--   3. 为新注册用户自动创建 profile。
--   4. 提供管理员设置示例。
--
-- 使用方式：
--   在 Supabase SQL Editor 中执行本文件。
-- ============================================================

-- 1. 创建用户资料表
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  full_name TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'member', 'admin')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- 2. 开启 profiles RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- 3. 重建 profiles 策略
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles;
DROP POLICY IF EXISTS "Anyone can view profiles" ON profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

CREATE POLICY "Anyone can view profiles"
ON profiles
FOR SELECT
USING (true);

CREATE POLICY "Users can update their own profile"
ON profiles
FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

CREATE POLICY "Admins can update all profiles"
ON profiles
FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);

-- 4. 可选：手动设置管理员
-- 将 USER_ID_HERE 替换成目标用户的真实 UUID 后再执行。
/*
INSERT INTO profiles (id, role)
VALUES ('USER_ID_HERE', 'admin')
ON CONFLICT (id) DO UPDATE
SET
  role = EXCLUDED.role,
  updated_at = NOW();
*/

-- 5. 自动为新注册用户创建 profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'user_name',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user();

-- 6. 验证结果
SELECT 'profiles table and trigger are ready' AS status;

SELECT *
FROM profiles
ORDER BY created_at DESC
LIMIT 10;
