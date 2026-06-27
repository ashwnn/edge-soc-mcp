/**
 * Normalized response envelope — the core contract.
 * Every tool returns an Envelope; the MCP handler emits it as both
 * pretty-printed text and structuredContent.
 */

export type ObservableType =
  | "ip"
  | "domain"
  | "url"
  | "hash"
  | "cve"
  | "email"
  | "username"
  | "password"
  | "command"
  | "binary"
  | "dll"
  | "attack_id"
  | "ja3"
  | "cert"
  | "hostname";

export type SourceStatus =
  | "ok"
  | "not_found"
  | "error"
  | "skipped"
  | "rate_limited"
  | "auth_missing"
  | "cached";

export interface SourceResult {
  /** Human-readable source name, e.g. "AbuseIPDB" */
  source: string;
  status: SourceStatus;
  /** One-line human summary */
  summary?: string;
  /** Normalized per-source fields — NOT a raw API dump */
  data?: unknown;
  /** e.g. ["non-commercial use only"] */
  restrictions?: string[];
  /** Pivot link for the analyst */
  reference_url?: string;
  latency_ms?: number;
  error?: string;
}

export interface Verdict {
  classification: "malicious" | "suspicious" | "benign" | "noise" | "unknown";
  /** 0–100 risk score, when meaningful */
  score?: number;
  confidence: "low" | "medium" | "high";
  /** Human-readable rollup */
  summary: string;
}

export interface Envelope {
  [key: string]: unknown;
  query: { type: ObservableType; value: string };
  verdict: Verdict;
  /**
   * Behavior tags such as: living-off-the-land, phishing, malware-delivery,
   * sideloading, scanner-noise, credential-exposure, …
   */
  behavior_tags: string[];
  /** ATT&CK technique IDs relevant to the artifact */
  attack_ids: string[];
  /** Sigma rule refs when available */
  rule_refs: string[];
  /** Natural-language explanation of a command or binary */
  command_explanation?: string;
  public_exposure_risk?: { exposed: boolean; note: string };
  /** Union of source restrictions hit */
  source_restrictions: string[];
  /** Concrete next pivots for the analyst */
  analyst_actions: string[];
  /** Evidence, separate from verdict */
  sources: SourceResult[];
  meta: {
    tool: string;
    generated_at: string;
    cache: "hit" | "miss" | "partial";
    elapsed_ms: number;
  };
}
