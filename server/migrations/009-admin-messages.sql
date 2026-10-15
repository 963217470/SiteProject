ALTER TABLE notifications ADD COLUMN category TEXT NOT NULL DEFAULT 'result' CHECK(category IN ('review','result','interaction','level','announcement'));
ALTER TABLE notifications ADD COLUMN archived_at INTEGER;
UPDATE notifications SET category='review' WHERE title LIKE '新的%待审核';
UPDATE notifications SET category='level' WHERE event_key LIKE 'level:%';
CREATE INDEX notifications_inbox ON notifications(user_id,archived_at,category,created_at DESC);
CREATE TABLE admin_activity(id TEXT PRIMARY KEY,actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,actor_name TEXT NOT NULL,action TEXT NOT NULL,kind TEXT NOT NULL,entity_id TEXT NOT NULL,detail TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE INDEX admin_activity_time ON admin_activity(created_at DESC);
CREATE TABLE admin_notices(id TEXT PRIMARY KEY,sender_id TEXT NOT NULL REFERENCES users(id),request_key TEXT NOT NULL,payload_hash TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,href TEXT NOT NULL,audience TEXT NOT NULL,recipient_count INTEGER NOT NULL,created_at INTEGER NOT NULL,UNIQUE(sender_id,request_key));
