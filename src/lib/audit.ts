/**
 * Best-effort audit logging to D1.
 * Never throws; silently no-ops if env.DB is missing or write fails.
 */

export interface AuditEntry {
  tool: string;
  query_type: string;
  /** sha256hex of the raw query value */
  query_hash: string;
  classification: string;
  timestamp: string;
  sources_used: string[];
}

/**
 * Write an audit entry to D1's `audit_log` table.
 * Errors are caught and swallowed — audit logging must never block a lookup.
 */
export async function logAudit(
  env: { DB?: D1Database },
  entry: AuditEntry
): Promise<void> {
  if (!env.DB) return;

  try {
    await env.DB.prepare(
      `INSERT INTO audit_log
         (tool, query_type, query_hash, classification, timestamp, sources_used)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(
        entry.tool,
        entry.query_type,
        entry.query_hash,
        entry.classification,
        entry.timestamp,
        JSON.stringify(entry.sources_used)
      )
      .run();
  } catch {
    // Intentionally swallowed — audit logging is best-effort
  }
}
