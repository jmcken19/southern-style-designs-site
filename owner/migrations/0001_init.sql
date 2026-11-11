-- Owner editor database (Cloudflare D1). Holds DRAFTS and the activity log only;
-- the published truth is always the Git repo (content/*.json + public/assets/img/hero/).

-- One row per editable area ("homepage" = photos, "reviews"): draft + last published copy.
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  revision INTEGER NOT NULL DEFAULT 1,   -- bumps on every save; stale saves are refused
  draft TEXT NOT NULL,
  live TEXT,
  repo_sha TEXT,                          -- blob sha of the repo file last seen
  last_commit TEXT,
  lock_until INTEGER,                     -- publish lock (ms epoch)
  updated_at TEXT NOT NULL,
  updated_by TEXT NOT NULL
);

-- Same request sent twice (double click, flaky Wi-Fi) returns the first result.
CREATE TABLE IF NOT EXISTS idem (
  key TEXT PRIMARY KEY,
  actor TEXT NOT NULL,
  response TEXT,
  created_at INTEGER NOT NULL
);

-- Who did what, when (also used for the daily safety limits).
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at TEXT NOT NULL,
  actor TEXT NOT NULL,
  item TEXT,
  action TEXT NOT NULL,
  detail TEXT
);
CREATE INDEX IF NOT EXISTS events_actor_at ON events(actor, at);
