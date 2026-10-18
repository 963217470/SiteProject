ALTER TABLE tasks ADD COLUMN publish_at INTEGER CHECK(publish_at IS NULL OR publish_at>0);
ALTER TABLE tasks ADD COLUMN scheduled_by TEXT REFERENCES users(id);
ALTER TABLE tasks ADD COLUMN schedule_error TEXT NOT NULL DEFAULT '';
CREATE INDEX task_schedule_due ON tasks(publish_at,id) WHERE status='draft' AND publish_at IS NOT NULL;
