-- D1 schema for edge-soc-mcp
-- Apply with: wrangler d1 execute edge_soc --file=migrations/0001_init.sql

-- Audit log: every tool invocation
CREATE TABLE IF NOT EXISTS audit_log (
  id           INTEGER  PRIMARY KEY AUTOINCREMENT,
  tool         TEXT     NOT NULL,
  query_type   TEXT     NOT NULL,
  -- sha256hex of the raw query value; never store the raw value
  query_hash   TEXT     NOT NULL,
  classification TEXT  NOT NULL,
  -- ISO-8601 UTC timestamp
  timestamp    TEXT     NOT NULL,
  -- JSON array of source names that returned results
  sources_used TEXT     NOT NULL DEFAULT '[]',
  created_at   TEXT     NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_audit_log_tool      ON audit_log(tool);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);

-- Source usage counters: daily aggregates per source
CREATE TABLE IF NOT EXISTS source_usage (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  source_name  TEXT    NOT NULL,
  -- Date (YYYY-MM-DD) for daily bucketing
  date         TEXT    NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0,
  error_count   INTEGER NOT NULL DEFAULT 0,
  updated_at   TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(source_name, date)
);

CREATE INDEX IF NOT EXISTS idx_source_usage_date ON source_usage(date);
