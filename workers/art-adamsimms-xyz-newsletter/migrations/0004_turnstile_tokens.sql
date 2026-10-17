-- SHA-256 hashes of Turnstile tokens already redeemed at signup, so a token
-- solved once can't be replayed for more signups. Siteverify accepts a token
-- for up to 5 minutes; the cron prunes rows older than an hour.
CREATE TABLE IF NOT EXISTS turnstile_tokens (
  hash       TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
