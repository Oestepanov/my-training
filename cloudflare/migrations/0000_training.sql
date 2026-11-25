CREATE TABLE entries (id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 1, deleted INTEGER NOT NULL DEFAULT 0);
--> statement-breakpoint
CREATE TABLE settings (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE unlock_sessions (hash TEXT PRIMARY KEY NOT NULL, expires INTEGER NOT NULL, generation TEXT NOT NULL);
--> statement-breakpoint
CREATE TABLE pin_attempts (key TEXT PRIMARY KEY NOT NULL, count INTEGER NOT NULL DEFAULT 0, until_ms INTEGER NOT NULL);
