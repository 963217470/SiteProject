-- Profile review workflow
-- Run this in Supabase SQL Editor.
-- It keeps avatar, nickname, and bio changes in profile_changes until an admin approves them.

CREATE TABLE IF NOT EXISTS profile_changes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  username TEXT,
  avatar_url TEXT,
  bio TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id),
  review_note TEXT
);

ALTER TABLE profile_changes ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_profile_changes_user_status_created
  ON profile_changes (user_id, status, created_at DESC);

DROP POLICY IF EXISTS "Users can create own profile changes" ON profile_changes;
DROP POLICY IF EXISTS "Users can view own profile changes" ON profile_changes;
DROP POLICY IF EXISTS "Admins can view profile changes" ON profile_changes;
DROP POLICY IF EXISTS "Admins can update profile changes" ON profile_changes;

CREATE POLICY "Users can create own profile changes"
ON profile_changes
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own profile changes"
ON profile_changes
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view profile changes"
ON profile_changes
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM profiles
    WHERE profiles.id = auth.uid()
      AND profiles.role = 'admin'
  )
);

CREATE POLICY "Admins can update profile changes"
ON profile_changes
FOR UPDATE
TO authenticated
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

GRANT SELECT, INSERT, UPDATE ON profile_changes TO authenticated;
