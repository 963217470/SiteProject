CREATE TABLE shop_products (
 id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', category TEXT NOT NULL DEFAULT '其他',
 cover_url TEXT NOT NULL DEFAULT '', price INTEGER NOT NULL CHECK(price BETWEEN 1 AND 1000000),
 stock INTEGER CHECK(stock IS NULL OR stock BETWEEN 0 AND 1000000),
 status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','published','archived')),
 revision INTEGER NOT NULL DEFAULT 1, created_by TEXT NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL
);
CREATE TABLE shop_orders (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), product_id TEXT NOT NULL REFERENCES shop_products(id),
 product_title TEXT NOT NULL, product_revision INTEGER NOT NULL, price INTEGER NOT NULL CHECK(price>0),
 request_key TEXT NOT NULL, note TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','fulfilled','cancelled')),
 fulfillment_note TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
 UNIQUE(user_id,request_key)
);
CREATE INDEX shop_orders_user ON shop_orders(user_id,created_at DESC);
CREATE INDEX shop_orders_status ON shop_orders(status,created_at DESC);
CREATE TABLE currency_ledger (
 id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), amount INTEGER NOT NULL CHECK(amount<>0),
 kind TEXT NOT NULL CHECK(kind IN ('article','checkin','redeem','refund')), source_key TEXT NOT NULL,
 reason TEXT NOT NULL, created_at INTEGER NOT NULL, UNIQUE(user_id,source_key)
);
CREATE INDEX currency_ledger_user ON currency_ledger(user_id,created_at DESC);
CREATE TRIGGER currency_no_update BEFORE UPDATE ON currency_ledger BEGIN SELECT RAISE(ABORT,'Currency ledger is immutable'); END;
CREATE TRIGGER currency_no_delete BEFORE DELETE ON currency_ledger BEGIN SELECT RAISE(ABORT,'Currency ledger is immutable'); END;
CREATE TRIGGER currency_no_debt BEFORE INSERT ON currency_ledger WHEN NEW.amount<0 AND
 (SELECT coalesce(sum(amount),0) FROM currency_ledger WHERE user_id=NEW.user_id)+NEW.amount<0
 BEGIN SELECT RAISE(ABORT,'Insufficient currency'); END;
CREATE TABLE currency_article_events(article_id TEXT PRIMARY KEY);
CREATE TRIGGER currency_like_insert AFTER INSERT ON article_likes BEGIN INSERT OR IGNORE INTO currency_article_events VALUES(NEW.article_id); END;
CREATE TRIGGER currency_like_delete AFTER DELETE ON article_likes BEGIN INSERT OR IGNORE INTO currency_article_events VALUES(OLD.article_id); END;
CREATE TRIGGER currency_article_publish AFTER UPDATE OF status,visibility ON articles WHEN NEW.status='published' BEGIN INSERT OR IGNORE INTO currency_article_events VALUES(NEW.id); END;
CREATE TRIGGER currency_article_insert AFTER INSERT ON articles WHEN NEW.status='published' BEGIN INSERT OR IGNORE INTO currency_article_events VALUES(NEW.id); END;
INSERT INTO currency_article_events SELECT id FROM articles WHERE status='published';
CREATE TRIGGER currency_checkin AFTER INSERT ON checkins WHEN NEW.streak>7 BEGIN
 INSERT OR IGNORE INTO currency_ledger VALUES(lower(hex(randomblob(16))),NEW.user_id,1,'checkin','checkin:'||NEW.day,'连续签到第 '||NEW.streak||' 天',rd_now());
END;
