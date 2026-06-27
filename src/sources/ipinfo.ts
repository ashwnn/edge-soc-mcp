import { fetchJson } from "../lib/http.js";
import type { SourceResult } from "../types.js";
import { authMissing, timedResult, type LookupEnv } from "./common.js";

interface IpInfoLiteResponse {
  ip?: string;
  country_code?: string;
  as_name?: string;
  as_domain?: string;
  as_type?: string;
  is_anonymous?: boolean;
}

export async function lookup(ip: string, env: LookupEnv): Promise<SourceResult> {
  if (!env.IPINFO_TOKEN) {
    return authMissing("IPinfo Lite", "IPINFO_TOKEN is not configured");
  }

  const startedAt = Date.now();
  const response = await fetchJson<IpInfoLiteResponse>(
    `https://api.ipinfo.io/lite/${encodeURIComponent(ip)}?token=${encodeURIComponent(env.IPINFO_TOKEN)}`
  );

  if (!response.ok) {
    return timedResult("IPinfo Lite", startedAt, {
      status: response.status === 404 ? "not_found" : "error",
      summary: "IPinfo lookup failed",
      error: response.error,
    });
  }

  return timedResult("IPinfo Lite", startedAt, {
    status: "ok",
    summary: `${response.data.as_name ?? "Unknown ASN"} in ${response.data.country_code ?? "unknown country"}`,
    data: response.data,
  });
}

