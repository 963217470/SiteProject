-- 游戏开发社团网站数据库表
-- 在 Supabase SQL Editor 中执行此脚本

-- 1. 用户资料表
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  username TEXT,
  avatar_url TEXT,
  bio TEXT,
  role TEXT CHECK (role IN ('member', 'admin')) DEFAULT 'member',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 资料修改审核表
CREATE TABLE IF NOT EXISTS profile_changes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  username TEXT,
  avatar_url TEXT,
  bio TEXT,
  status TEXT CHECK (status IN ('pending', 'approved', 'rejected')) DEFAULT 'pending',
  reject_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  reviewed_at TIMESTAMP WITH TIME ZONE
);

-- 3. 邀请链接表
CREATE TABLE IF NOT EXISTS invite_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES profiles(id),
  used_by UUID REFERENCES profiles(id),
  used_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. 文章表
CREATE TABLE IF NOT EXISTS articles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT,
  summary TEXT,
  cover_url TEXT,
  author_id UUID REFERENCES profiles(id),
  tags TEXT[] DEFAULT '{}',
  visibility TEXT CHECK (visibility IN ('public', 'internal')) DEFAULT 'public',
  status TEXT CHECK (status IN ('draft', 'pending', 'published', 'rejected')) DEFAULT 'draft',
  reject_reason TEXT,
  likes_count INTEGER DEFAULT 0,
  comments_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  published_at TIMESTAMP WITH TIME ZONE
);

-- 5. 文章点赞表
CREATE TABLE IF NOT EXISTS article_likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(article_id, user_id)
);

-- 6. 评论表
CREATE TABLE IF NOT EXISTS comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. 知识库文件表
CREATE TABLE IF NOT EXISTS kb_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL,
  parent_path TEXT,
  type TEXT CHECK (type IN ('file', 'directory', 'image')) DEFAULT 'file',
  content TEXT,
  size INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(path)
);

-- 启用 RLS (Row Level Security)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invite_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE article_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_files ENABLE ROW LEVEL SECURITY;

-- profiles 表的 RLS 策略
-- 用户可以查看所有人的资料
CREATE POLICY "Profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

-- 用户只能更新自己的资料
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- 用户只能插入自己的资料
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- profile_changes 表的 RLS 策略
-- 用户可以查看自己的修改申请
CREATE POLICY "Users can view own profile changes" ON profile_changes
  FOR SELECT USING (auth.uid() = user_id);

-- 用户可以创建修改申请
CREATE POLICY "Users can create profile changes" ON profile_changes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 管理员可以查看所有修改申请
CREATE POLICY "Admins can view all profile changes" ON profile_changes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 管理员可以更新修改申请
CREATE POLICY "Admins can update profile changes" ON profile_changes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- invite_links 表的 RLS 策略
-- 管理员可以创建邀请链接
CREATE POLICY "Admins can create invite links" ON invite_links
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 管理员可以查看所有邀请链接
CREATE POLICY "Admins can view all invite links" ON invite_links
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 管理员可以删除邀请链接
CREATE POLICY "Admins can delete invite links" ON invite_links
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 任何人都可以使用未过期、未使用的邀请链接
CREATE POLICY "Anyone can use valid invite links" ON invite_links
  FOR UPDATE USING (
    used_by IS NULL AND expires_at > NOW()
  );

-- articles 表的 RLS 策略
-- 公开文章所有人可见
CREATE POLICY "Public articles are viewable by everyone" ON articles
  FOR SELECT USING (
    (status = 'published' AND visibility = 'public') OR
    (auth.uid() = author_id) OR
    (EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('member', 'admin')
    ))
  );

-- 社员和管理员可以创建文章，未登录用户也可以提交（author_id 为 NULL）
CREATE POLICY "Members can create articles" ON articles
  FOR INSERT WITH CHECK (
    (author_id IS NULL) OR
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('member', 'admin')
    )
  );

-- 作者可以更新自己的文章
CREATE POLICY "Authors can update own articles" ON articles
  FOR UPDATE USING (auth.uid() = author_id);

-- 管理员可以更新所有文章
CREATE POLICY "Admins can update all articles" ON articles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 作者可以删除自己的草稿
CREATE POLICY "Authors can delete own drafts" ON articles
  FOR DELETE USING (
    auth.uid() = author_id AND status = 'draft'
  );

-- 管理员可以删除所有文章
CREATE POLICY "Admins can delete all articles" ON articles
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- article_likes 表的 RLS 策略
-- 用户可以查看所有点赞
CREATE POLICY "Likes are viewable by everyone" ON article_likes
  FOR SELECT USING (true);

-- 用户可以点赞
CREATE POLICY "Users can like articles" ON article_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 用户可以取消点赞
CREATE POLICY "Users can unlike articles" ON article_likes
  FOR DELETE USING (auth.uid() = user_id);

-- comments 表的 RLS 策略
-- 公开文章的评论所有人可见
CREATE POLICY "Comments are viewable by everyone" ON comments
  FOR SELECT USING (true);

-- 社员和管理员可以评论
CREATE POLICY "Members can create comments" ON comments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('member', 'admin')
    )
  );

-- 用户可以更新自己的评论
CREATE POLICY "Users can update own comments" ON comments
  FOR UPDATE USING (auth.uid() = user_id);

-- 用户可以删除自己的评论
CREATE POLICY "Users can delete own comments" ON comments
  FOR DELETE USING (auth.uid() = user_id);

-- 管理员可以删除所有评论
CREATE POLICY "Admins can delete all comments" ON comments
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- kb_files 表的 RLS 策略
-- 社员和管理员可以查看知识库文件
CREATE POLICY "Members can view kb files" ON kb_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('member', 'admin')
    )
  );

-- 社员和管理员可以上传知识库文件
CREATE POLICY "Members can insert kb files" ON kb_files
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('member', 'admin')
    )
  );

-- 社员和管理员可以更新知识库文件
CREATE POLICY "Members can update kb files" ON kb_files
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('member', 'admin')
    )
  );

-- 管理员可以删除知识库文件
CREATE POLICY "Admins can delete kb files" ON kb_files
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_articles_status ON articles(status);
CREATE INDEX IF NOT EXISTS idx_articles_visibility ON articles(visibility);
CREATE INDEX IF NOT EXISTS idx_articles_author ON articles(author_id);
CREATE INDEX IF NOT EXISTS idx_articles_created ON articles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_article_likes_article ON article_likes(article_id);
CREATE INDEX IF NOT EXISTS idx_article_likes_user ON article_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_article ON comments(article_id);
CREATE INDEX IF NOT EXISTS idx_invite_links_code ON invite_links(code);
CREATE INDEX IF NOT EXISTS idx_kb_files_path ON kb_files(path);
CREATE INDEX IF NOT EXISTS idx_kb_files_parent ON kb_files(parent_path);
CREATE INDEX IF NOT EXISTS idx_kb_files_type ON kb_files(type);

-- 创建触发器：自动更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_articles_updated_at
  BEFORE UPDATE ON articles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_comments_updated_at
  BEFORE UPDATE ON comments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_kb_files_updated_at
  BEFORE UPDATE ON kb_files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- 创建触发器：用户注册时自动创建 profile
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'user_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();
