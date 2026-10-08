CREATE TABLE disciplines (id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE);
INSERT INTO disciplines VALUES ('art','美术'),('technical-art','技术美术'),('design','策划'),('programming','程序'),('operations','运营');
CREATE TABLE member_identity (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE, discipline_id TEXT REFERENCES disciplines(id), office TEXT CHECK(office IN ('president','vice-president') OR office IS NULL));
CREATE TABLE experience_levels (threshold INTEGER PRIMARY KEY CHECK(threshold>=0), title TEXT NOT NULL UNIQUE);
INSERT INTO experience_levels VALUES (0,'见习社员'),(100,'正式社员'),(500,'资深社员'),(1500,'大佬'),(4000,'导师');
CREATE TABLE tasks (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
 type TEXT NOT NULL CHECK(type IN ('publish','read','branch','gamejam','proof')),
 target INTEGER NOT NULL CHECK(target BETWEEN 1 AND 1000), reward INTEGER NOT NULL CHECK(reward BETWEEN 1 AND 10000),
 status TEXT NOT NULL CHECK(status IN ('draft','active','closed')), deadline INTEGER,
 requirements TEXT NOT NULL DEFAULT '{}', created_by TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL
);
CREATE TABLE task_activity (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, entity_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), UNIQUE(kind,entity_id,user_id));
CREATE INDEX task_activity_user ON task_activity(user_id,kind,id);
INSERT OR IGNORE INTO task_activity(kind,entity_id,user_id) SELECT 'publish',id,author_id FROM articles WHERE status='published' OR published_at IS NOT NULL;
INSERT OR IGNORE INTO task_activity(kind,entity_id,user_id) SELECT 'branch',id,created_by FROM knowledge_branches WHERE created_by IS NOT NULL;
INSERT OR IGNORE INTO task_activity(kind,entity_id,user_id) SELECT 'branch-request',id,requester_id FROM knowledge_branch_requests WHERE status='approved';
CREATE TRIGGER task_article_published AFTER UPDATE OF status ON articles WHEN NEW.status='published' AND OLD.status<>'published' BEGIN
 INSERT OR IGNORE INTO task_activity(kind,entity_id,user_id) VALUES('publish',NEW.id,NEW.author_id);
END;
CREATE TRIGGER task_article_inserted AFTER INSERT ON articles WHEN NEW.status='published' BEGIN
 INSERT OR IGNORE INTO task_activity(kind,entity_id,user_id) VALUES('publish',NEW.id,NEW.author_id);
END;
CREATE TRIGGER task_branch_created AFTER INSERT ON knowledge_branches WHEN NEW.created_by IS NOT NULL BEGIN
 INSERT OR IGNORE INTO task_activity(kind,entity_id,user_id) VALUES('branch',NEW.id,NEW.created_by);
END;
CREATE TRIGGER task_branch_approved AFTER UPDATE OF status ON knowledge_branch_requests WHEN NEW.status='approved' AND OLD.status<>'approved' BEGIN
 INSERT OR IGNORE INTO task_activity(kind,entity_id,user_id) VALUES('branch-request',NEW.id,NEW.requester_id);
END;
CREATE TABLE task_enrollments (
 task_id TEXT NOT NULL REFERENCES tasks(id), user_id TEXT NOT NULL REFERENCES users(id),
 joined_at INTEGER NOT NULL, activity_baseline INTEGER NOT NULL,
 state TEXT NOT NULL DEFAULT 'joined' CHECK(state IN ('joined','submitted','rejected','completed','revoked')),
 completed_at INTEGER, PRIMARY KEY(task_id,user_id)
);
CREATE TABLE task_reads (task_id TEXT NOT NULL, user_id TEXT NOT NULL, article_id TEXT NOT NULL, seconds INTEGER NOT NULL DEFAULT 0 CHECK(seconds>=0), PRIMARY KEY(task_id,user_id,article_id), FOREIGN KEY(task_id,user_id) REFERENCES task_enrollments(task_id,user_id));
CREATE TABLE task_submissions (
 id TEXT PRIMARY KEY, task_id TEXT NOT NULL, user_id TEXT NOT NULL, note TEXT NOT NULL, url TEXT NOT NULL, files TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','rejected')),
 submitted_at INTEGER NOT NULL, reviewed_at INTEGER, reviewed_by TEXT REFERENCES users(id), review_note TEXT NOT NULL DEFAULT '',
 FOREIGN KEY(task_id,user_id) REFERENCES task_enrollments(task_id,user_id)
);
CREATE UNIQUE INDEX task_one_pending ON task_submissions(task_id,user_id) WHERE status='pending';
CREATE TABLE experience_ledger (
 id TEXT PRIMARY KEY, task_id TEXT NOT NULL, user_id TEXT NOT NULL REFERENCES users(id), amount INTEGER NOT NULL,
 created_at INTEGER NOT NULL, created_by TEXT NOT NULL REFERENCES users(id), reason TEXT NOT NULL,
 reverses_id TEXT UNIQUE REFERENCES experience_ledger(id), FOREIGN KEY(task_id,user_id) REFERENCES task_enrollments(task_id,user_id)
);
CREATE UNIQUE INDEX task_one_reward ON experience_ledger(task_id,user_id) WHERE amount>0;
CREATE TRIGGER experience_no_update BEFORE UPDATE ON experience_ledger BEGIN SELECT RAISE(ABORT,'Experience ledger is append-only'); END;
CREATE TRIGGER experience_no_delete BEFORE DELETE ON experience_ledger BEGIN SELECT RAISE(ABORT,'Experience ledger is append-only'); END;
