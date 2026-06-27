import { fetchJson } from "../lib/http.js";
import type { SourceResult } from "../types.js";
import { timedResult, type LookupEnv } from "./common.js";

interface NvdResponse {
  vulnerabilities?: Array<{
    cve?: {
      id?: string;
      descriptions?: Array<{ lang?: string; value?: string }>;
      metrics?: Record<string, unknown>;
      references?: Array<{ url?: string }>;
    };
  }>;
}

export async function lookup(cve: string, env: LookupEnv): Promise<SourceResult> {
  const startedAt = Date.now();
  const response = await fetchJson<NvdResponse>(
    `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${encodeURIComponent(cve)}`,
    {
      headers: env.NVD_API_KEY ? { apiKey: env.NVD_API_KEY } : {},
    }
  );

  if (!response.ok) {
    return timedResult("NVD", startedAt, {
      status: "error",
      summary: "NVD lookup failed",
      error: response.error,
    });
  }

  const item = response.data.vulnerabilities?.[0]?.cve;
  if (!item) {
    return timedResult("NVD", startedAt, {
      status: "not_found",
      summary: "No NVD CVE record found",
    });
  }

  return timedResult("NVD", startedAt, {
    status: "ok",
    summary: item.descriptions?.find((entry) => entry.lang === "en")?.value ?? "NVD CVE record found",
    data: item,
    reference_url: item.references?.[0]?.url,
  });
}

