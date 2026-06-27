import type { SourceResult } from "../types.js";

export interface LookupEnv {
  ABUSE_CH_AUTH_KEY?: string;
  ABUSEIPDB_API_KEY?: string;
  GREYNOISE_API_KEY?: string;
  IPINFO_TOKEN?: string;
  URLSCAN_API_KEY?: string;
  PULSEDIVE_API_KEY?: string;
  OTX_API_KEY?: string;
  NVD_API_KEY?: string;
  HUDSONROCK_API_KEY?: string;
  HIBP_API_KEY?: string;
  SPUR_TOKEN?: string;
  VT_API_KEY?: string;
  CACHE?: KVNamespace;
  CORPORA?: R2Bucket;
}

export function authMissing(source: string, summary: string): SourceResult {
  return {
    source,
    status: "auth_missing",
    summary,
  };
}

export function skipped(source: string, summary: string): SourceResult {
  return {
    source,
    status: "skipped",
    summary,
  };
}

export function timedResult(
  source: string,
  startedAt: number,
  result: Omit<SourceResult, "source" | "latency_ms">
): SourceResult {
  return {
    source,
    latency_ms: Date.now() - startedAt,
    ...result,
  };
}

export async function readJsonObject<T>(object: R2ObjectBody | null): Promise<T | null> {
  if (object === null) return null;
  try {
    return (await object.json()) as T;
  } catch {
    return null;
  }
}

