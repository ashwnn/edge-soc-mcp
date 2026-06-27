import { fetchJson } from "../lib/http.js";
import type { SourceResult } from "../types.js";
import { authMissing, timedResult, type LookupEnv } from "./common.js";

type VtResponse = Record<string, unknown>;

export async function lookup(
  section: "ip_addresses" | "domains" | "urls" | "files",
  value: string,
  env: LookupEnv
): Promise<SourceResult> {
  if (!env.VT_API_KEY) {
    return authMissing("VirusTotal", "VT_API_KEY is not configured");
  }

  const startedAt = Date.now();
  const response = await fetchJson<VtResponse>(
    `https://www.virustotal.com/api/v3/${section}/${encodeURIComponent(value)}`,
    {
      headers: { "x-apikey": env.VT_API_KEY },
    }
  );

  if (!response.ok) {
    return timedResult("VirusTotal", startedAt, {
      status: response.status === 429 ? "rate_limited" : "error",
      summary: "VirusTotal lookup failed",
      error: response.error,
      restrictions: ["non-commercial use only"],
    });
  }

  return timedResult("VirusTotal", startedAt, {
    status: "ok",
    summary: "VirusTotal metadata returned",
    data: response.data,
    restrictions: ["non-commercial use only"],
  });
}
