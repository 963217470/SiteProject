ALTER TABLE comments ADD COLUMN status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected'));
ALTER TABLE comments ADD COLUMN parent_id TEXT REFERENCES comments(id) ON DELETE CASCADE;
ALTER TABLE comments ADD COLUMN review_note TEXT NOT NULL DEFAULT '';
ALTER TABLE comments ADD COLUMN reviewed_by TEXT REFERENCES users(id);
ALTER TABLE comments ADD COLUMN reviewed_at INTEGER;
UPDATE comments SET status='approved';
DROP TRIGGER comments_insert;
DROP TRIGGER comments_delete;
CREATE TRIGGER comments_insert AFTER INSERT ON comments WHEN NEW.status='approved' BEGIN
 UPDATE articles SET comments_count=comments_count+1 WHERE id=NEW.article_id; END;
CREATE TRIGGER comments_delete AFTER DELETE ON comments WHEN OLD.status='approved' BEGIN
 UPDATE articles SET comments_count=max(0,comments_count-1) WHERE id=OLD.article_id; END;
CREATE TRIGGER comments_review_count AFTER UPDATE OF status ON comments BEGIN
 UPDATE articles SET comments_count=max(0,comments_count+(NEW.status='approved')-(OLD.status='approved')) WHERE id=NEW.article_id; END;
CREATE TABLE community_experience (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), source_key TEXT NOT NULL,
 amount INTEGER NOT NULL CHECK(amount>0), reason TEXT NOT NULL, created_at INTEGER NOT NULL,
 UNIQUE(user_id,source_key));
CREATE TRIGGER community_xp_no_update BEFORE UPDATE ON community_experience BEGIN SELECT RAISE(ABORT,'Experience is immutable'); END;
CREATE TRIGGER community_xp_no_delete BEFORE DELETE ON community_experience BEGIN SELECT RAISE(ABORT,'Experience is immutable'); END;
CREATE TRIGGER task_xp_positive BEFORE INSERT ON experience_ledger WHEN NEW.amount<=0 BEGIN SELECT RAISE(ABORT,'Experience cannot be consumed'); END;
CREATE TABLE checkins(user_id TEXT NOT NULL REFERENCES users(id), day TEXT NOT NULL, streak INTEGER NOT NULL, PRIMARY KEY(user_id,day));
CREATE TABLE daily_reads(user_id TEXT NOT NULL REFERENCES users(id), day TEXT NOT NULL, article_id TEXT NOT NULL, seconds INTEGER NOT NULL CHECK(seconds BETWEEN 0 AND 150), PRIMARY KEY(user_id,day,article_id));
CREATE TABLE rewarded_content(kind TEXT NOT NULL, entity_id TEXT NOT NULL, PRIMARY KEY(kind,entity_id));
INSERT INTO rewarded_content SELECT 'article',id FROM articles WHERE status='published';
INSERT INTO rewarded_content SELECT 'comment',id FROM comments WHERE status='approved';
DELETE FROM experience_levels;
INSERT INTO experience_levels(threshold,title) VALUES(0,'新人'),(50,'见习社员'),(300,'正式社员'),(500,'资深社员');
ALTER TABLE tasks ADD COLUMN is_advanced INTEGER NOT NULL DEFAULT 0 CHECK(is_advanced IN (0,1));
CREATE TABLE notifications(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),event_key TEXT NOT NULL,
 title TEXT NOT NULL,body TEXT NOT NULL,href TEXT NOT NULL,created_at INTEGER NOT NULL,read_at INTEGER,UNIQUE(user_id,event_key));
CREATE INDEX notifications_user ON notifications(user_id,created_at DESC);
CREATE TABLE community_events(id TEXT PRIMARY KEY,kind TEXT NOT NULL,entity_id TEXT NOT NULL,user_id TEXT NOT NULL,
 old_status TEXT,new_status TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE community_levels(user_id TEXT PRIMARY KEY REFERENCES users(id),threshold INTEGER NOT NULL);
CREATE TRIGGER community_article_delete AFTER DELETE ON articles BEGIN
 INSERT INTO community_events VALUES(lower(hex(randomblob(16))),'article',OLD.id,OLD.author_id,OLD.status,'archived',rd_now()); END;
CREATE TRIGGER community_article_resubmit AFTER UPDATE OF title,content ON articles WHEN NEW.status='pending' AND OLD.status='pending' AND (OLD.title<>NEW.title OR OLD.content<>NEW.content) BEGIN
 INSERT INTO community_events VALUES(lower(hex(randomblob(16))),'article',NEW.id,NEW.author_id,OLD.status,NEW.status,rd_now()); END;
CREATE TRIGGER community_catalog_resubmit AFTER UPDATE OF revision ON catalog_items WHEN NEW.status='pending' AND OLD.status='pending' AND OLD.revision<>NEW.revision BEGIN
 INSERT INTO community_events VALUES(lower(hex(randomblob(16))),'catalog',NEW.id,NEW.author_id,OLD.status,NEW.status,rd_now()); END;
CREATE TRIGGER community_catalog_delete AFTER DELETE ON catalog_items BEGIN
 INSERT INTO community_events VALUES(lower(hex(randomblob(16))),'catalog',OLD.id,OLD.author_id,OLD.status,'archived',rd_now()); END;
INSERT INTO community_levels SELECT p.id,coalesce((SELECT max(threshold) FROM experience_levels WHERE threshold<=(SELECT coalesce(sum(amount),0) FROM experience_ledger WHERE user_id=p.id AND amount>0)),0) FROM profiles p;
CREATE TRIGGER community_article_insert AFTER INSERT ON articles BEGIN
 INSERT INTO community_events VALUES(lower(hex(randomblob(16))),'article',NEW.id,NEW.author_id,NULL,NEW.status,rd_now()); END;
CREATE TRIGGER community_article_update AFTER UPDATE OF status ON articles WHEN OLD.status<>NEW.status BEGIN
 INSERT INTO community_events VALUES(lower(hex(randomblob(16))),'article',NEW.id,NEW.author_id,OLD.status,NEW.status,rd_now()); END;
CREATE TRIGGER community_comment_insert AFTER INSERT ON comments BEGIN
 INSERT INTO community_events VALUES(lower(hex(randomblob(16))),'comment',NEW.id,NEW.user_id,NULL,NEW.status,rd_now()); END;
CREATE TRIGGER community_comment_update AFTER UPDATE OF status ON comments WHEN OLD.status<>NEW.status BEGIN
 INSERT INTO community_events VALUES(lower(hex(randomblob(16))),'comment',NEW.id,NEW.user_id,OLD.status,NEW.status,rd_now()); END;
CREATE TRIGGER community_catalog_insert AFTER INSERT ON catalog_items BEGIN
 INSERT INTO community_events VALUES(lower(hex(randomblob(16))),'catalog',NEW.id,NEW.author_id,NULL,NEW.status,rd_now()); END;
CREATE TRIGGER community_catalog_update AFTER UPDATE OF status ON catalog_items WHEN OLD.status<>NEW.status BEGIN
 INSERT INTO community_events VALUES(lower(hex(randomblob(16))),'catalog',NEW.id,NEW.author_id,OLD.status,NEW.status,rd_now()); END;
CREATE TRIGGER community_profile_insert AFTER INSERT ON profile_changes BEGIN
 INSERT INTO community_events VALUES(lower(hex(randomblob(16))),'profile',NEW.id,NEW.user_id,NULL,NEW.status,rd_now()); END;
CREATE TRIGGER community_profile_update AFTER UPDATE OF status ON profile_changes WHEN OLD.status<>NEW.status BEGIN
 INSERT INTO community_events VALUES(lower(hex(randomblob(16))),'profile',NEW.id,NEW.user_id,OLD.status,NEW.status,rd_now()); END;
CREATE TRIGGER community_branch_insert AFTER INSERT ON knowledge_branch_requests BEGIN
 INSERT INTO community_events VALUES(lower(hex(randomblob(16))),'branch',NEW.id,NEW.requester_id,NULL,NEW.status,rd_now()); END;
CREATE TRIGGER community_branch_update AFTER UPDATE OF status ON knowledge_branch_requests WHEN OLD.status<>NEW.status BEGIN
 INSERT INTO community_events VALUES(lower(hex(randomblob(16))),'branch',NEW.id,NEW.requester_id,OLD.status,NEW.status,rd_now()); END;
CREATE TRIGGER community_proof_insert AFTER INSERT ON task_submissions BEGIN
 INSERT INTO community_events VALUES(lower(hex(randomblob(16))),'proof',NEW.id,NEW.user_id,NULL,NEW.status,rd_now()); END;
CREATE TRIGGER community_proof_update AFTER UPDATE OF status ON task_submissions WHEN OLD.status<>NEW.status BEGIN
 INSERT INTO community_events VALUES(lower(hex(randomblob(16))),'proof',NEW.id,NEW.user_id,OLD.status,NEW.status,rd_now()); END;
