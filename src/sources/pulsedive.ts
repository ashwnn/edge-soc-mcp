import { fetchJson } from "../lib/http.js";
import type { SourceResult } from "../types.js";
import { authMissing, timedResult, type LookupEnv } from "./common.js";

type PulsediveResponse = Record<string, unknown>;

export async function lookup(value: string, env: LookupEnv): Promise<SourceResult> {
  if (!env.PULSEDIVE_API_KEY) {
    return authMissing("Pulsedive", "PULSEDIVE_API_KEY is not configured");
  }

  const startedAt = Date.now();
  const response = await fetchJson<PulsediveResponse>(
    `https://pulsedive.com/api/info.php?indicator=${encodeURIComponent(value)}&pretty=1`,
    {
      headers: { Authorization: `Bearer ${env.PULSEDIVE_API_KEY}` },
    }
  );

  if (!response.ok) {
    return timedResult("Pulsedive", startedAt, {
      status: "error",
      summary: "Pulsedive lookup failed",
      error: response.error,
    });
  }

  return timedResult("Pulsedive", startedAt, {
    status: "ok",
    summary: "Pulsedive indicator context returned",
    data: response.data,
  });
}

