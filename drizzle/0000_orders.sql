CREATE TABLE orders (
 id TEXT PRIMARY KEY, token TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL,
 name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL,
 method TEXT NOT NULL, address TEXT NOT NULL, notes TEXT NOT NULL,
 items TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'new',
 amount INTEGER, payment_status TEXT NOT NULL DEFAULT 'unpaid',
 payment_reference TEXT UNIQUE, checkout_url TEXT
);
