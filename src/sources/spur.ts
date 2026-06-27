import { fetchJson } from "../lib/http.js";
import type { SourceResult } from "../types.js";
import { authMissing, timedResult, type LookupEnv } from "./common.js";

type SpurResponse = Record<string, unknown>;

export async function lookup(ip: string, env: LookupEnv): Promise<SourceResult> {
  if (!env.SPUR_TOKEN) {
    return authMissing("Spur Context", "SPUR_TOKEN is not configured");
  }

  const startedAt = Date.now();
  const response = await fetchJson<SpurResponse>(
    `https://api.spur.us/v2/context/${encodeURIComponent(ip)}`,
    {
      headers: { Token: env.SPUR_TOKEN },
    }
  );

  if (!response.ok) {
    return timedResult("Spur Context", startedAt, {
      status: "error",
      summary: "Spur lookup failed",
      error: response.error,
      restrictions: ["paid tier only"],
    });
  }

  return timedResult("Spur Context", startedAt, {
    status: "ok",
    summary: "Spur proxy or identity context returned",
    data: response.data,
    restrictions: ["paid tier only"],
  });
}

