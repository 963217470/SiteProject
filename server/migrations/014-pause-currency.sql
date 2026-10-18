-- Pause earning without changing existing balances, experience or check-in records.
DROP TRIGGER IF EXISTS currency_checkin;
DROP TRIGGER IF EXISTS currency_like_insert;
DROP TRIGGER IF EXISTS currency_like_delete;
DROP TRIGGER IF EXISTS currency_article_publish;
DROP TRIGGER IF EXISTS currency_article_insert;
DELETE FROM currency_article_events;
