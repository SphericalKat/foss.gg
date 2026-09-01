ALTER TABLE links ADD COLUMN owner_username TEXT NOT NULL DEFAULT 'admin';

CREATE TABLE users (
  username TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_username TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('created', 'updated', 'deleted')),
  kind TEXT NOT NULL CHECK (kind IN ('path', 'subdomain')),
  key TEXT NOT NULL,
  destination TEXT NOT NULL,
  created_at TEXT NOT NULL
);
