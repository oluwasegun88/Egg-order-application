ALTER TABLE orders ADD COLUMN preferred_date TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE orders ADD COLUMN admin_notes TEXT NOT NULL DEFAULT '';
--> statement-breakpoint
ALTER TABLE orders ADD COLUMN payment_method TEXT;
--> statement-breakpoint
CREATE TABLE prices (id TEXT PRIMARY KEY, amount INTEGER NOT NULL);
