import { fetchJson } from "../lib/http.js";
import type { SourceResult } from "../types.js";
import { authMissing, timedResult, type LookupEnv } from "./common.js";

type OtxResponse = Record<string, unknown>;

export async function lookup(
  section: "IPv4" | "domain" | "url" | "file",
  value: string,
  env: LookupEnv
): Promise<SourceResult> {
  if (!env.OTX_API_KEY) {
    return authMissing("AlienVault OTX", "OTX_API_KEY is not configured");
  }

  const startedAt = Date.now();
  const response = await fetchJson<OtxResponse>(
    `https://otx.alienvault.com/api/v1/indicators/${section}/${encodeURIComponent(value)}/general`,
    {
      headers: { "X-OTX-API-KEY": env.OTX_API_KEY },
    }
  );

  if (!response.ok) {
    return timedResult("AlienVault OTX", startedAt, {
      status: "error",
      summary: "OTX lookup failed",
      error: response.error,
    });
  }

  return timedResult("AlienVault OTX", startedAt, {
    status: "ok",
    summary: "OTX indicator context returned",
    data: response.data,
  });
}

