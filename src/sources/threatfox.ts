import { fetchJson } from "../lib/http.js";
import type { SourceResult } from "../types.js";
import { authMissing, timedResult, type LookupEnv } from "./common.js";

interface ThreatFoxResponse {
  query_status?: string;
  data?: Array<Record<string, unknown>>;
}

export async function lookup(value: string, env: LookupEnv): Promise<SourceResult> {
  if (!env.ABUSE_CH_AUTH_KEY) {
    return authMissing("ThreatFox", "ABUSE_CH_AUTH_KEY is not configured");
  }

  const startedAt = Date.now();
  const response = await fetchJson<ThreatFoxResponse>(
    "https://threatfox-api.abuse.ch/api/v1/",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Auth-Key": env.ABUSE_CH_AUTH_KEY,
      },
      body: JSON.stringify({
        query: "search_ioc",
        search_term: value,
      }),
    }
  );

  if (!response.ok) {
    return timedResult("ThreatFox", startedAt, {
      status: "error",
      summary: "ThreatFox lookup failed",
      error: response.error,
    });
  }

  const hits = response.data.data ?? [];
  return timedResult("ThreatFox", startedAt, {
    status: hits.length ? "ok" : "not_found",
    summary: hits.length ? `${hits.length} ThreatFox IOC hit(s)` : "No ThreatFox IOC hit found",
    data: hits.slice(0, 10),
  });
}

