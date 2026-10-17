ALTER TABLE tasks ADD COLUMN audience TEXT;
CREATE TABLE task_recipients (
 task_id TEXT NOT NULL REFERENCES tasks(id),
 user_id TEXT NOT NULL REFERENCES users(id),
 assigned_at INTEGER NOT NULL,
 PRIMARY KEY(task_id,user_id)
);
CREATE INDEX task_recipients_user ON task_recipients(user_id,task_id);
