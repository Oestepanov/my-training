ALTER TABLE unlock_sessions ADD COLUMN label TEXT NOT NULL DEFAULT 'Устройство';
--> statement-breakpoint
ALTER TABLE unlock_sessions ADD COLUMN created_ms INTEGER NOT NULL DEFAULT 0;
