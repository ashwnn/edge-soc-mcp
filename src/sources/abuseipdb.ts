import { fetchJson } from "../lib/http.js";
import type { SourceResult } from "../types.js";
import { authMissing, timedResult, type LookupEnv } from "./common.js";

interface AbuseIpDbResponse {
  data?: {
    abuseConfidenceScore?: number;
    countryCode?: string;
    isp?: string;
    domain?: string;
    totalReports?: number;
    usageType?: string;
    lastReportedAt?: string;
  };
}

export async function lookup(ip: string, env: LookupEnv): Promise<SourceResult> {
  if (!env.ABUSEIPDB_API_KEY) {
    return authMissing("AbuseIPDB", "ABUSEIPDB_API_KEY is not configured");
  }

  const startedAt = Date.now();
  const url = `https://api.abuseipdb.com/api/v2/check?ipAddress=${encodeURIComponent(ip)}&maxAgeInDays=90`;
  const response = await fetchJson<AbuseIpDbResponse>(url, {
    headers: { Key: env.ABUSEIPDB_API_KEY, Accept: "application/json" },
  });

  if (!response.ok) {
    return timedResult("AbuseIPDB", startedAt, {
      status: response.status === 429 ? "rate_limited" : "error",
      summary: "AbuseIPDB lookup failed",
      error: response.error,
    });
  }

  const data = response.data.data;
  if (!data) {
    return timedResult("AbuseIPDB", startedAt, {
      status: "not_found",
      summary: "AbuseIPDB returned no record",
    });
  }

  return timedResult("AbuseIPDB", startedAt, {
    status: "ok",
    summary: `Abuse confidence ${data.abuseConfidenceScore ?? 0}/100 from ${data.totalReports ?? 0} reports`,
    data: {
      score: data.abuseConfidenceScore ?? 0,
      reports: data.totalReports ?? 0,
      usage_type: data.usageType,
      isp: data.isp,
      country: data.countryCode,
      domain: data.domain,
      last_reported_at: data.lastReportedAt,
    },
    reference_url: `https://www.abuseipdb.com/check/${encodeURIComponent(ip)}`,
    restrictions: ["non-commercial use only on free tier"],
  });
}

