-- Server-only Postgres schema. Hosted RLS/authentication must be configured before shared use.
CREATE TABLE IF NOT EXISTS clients(id TEXT PRIMARY KEY,name TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS engagements(id TEXT PRIMARY KEY,client_id TEXT REFERENCES clients(id),tax_year INT NOT NULL,packet_hash TEXT NOT NULL,raw_packet JSONB NOT NULL,revision INT NOT NULL DEFAULT 0,state JSONB NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS workpaper_adjustments(id TEXT PRIMARY KEY,engagement_id TEXT REFERENCES engagements(id),target_key TEXT NOT NULL,payload JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS review_records(id TEXT PRIMARY KEY,engagement_id TEXT REFERENCES engagements(id),kind TEXT NOT NULL,payload JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS audit_events(id TEXT PRIMARY KEY,engagement_id TEXT REFERENCES engagements(id),revision INT NOT NULL,payload JSONB NOT NULL);
CREATE TABLE IF NOT EXISTS command_receipts(engagement_id TEXT NOT NULL,request_id TEXT NOT NULL,actor_id TEXT NOT NULL,fingerprint TEXT NOT NULL,revision INT NOT NULL,PRIMARY KEY(engagement_id,request_id));
CREATE TABLE IF NOT EXISTS attachments(id TEXT PRIMARY KEY,engagement_id TEXT REFERENCES engagements(id),name TEXT NOT NULL,mime TEXT NOT NULL,content_hash TEXT NOT NULL,data_base64 TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS records_engagement ON review_records(engagement_id,kind);
