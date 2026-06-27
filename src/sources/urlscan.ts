import { fetchJson } from "../lib/http.js";
import type { SourceResult } from "../types.js";
import { authMissing, timedResult, type LookupEnv } from "./common.js";

interface UrlscanSearchResponse {
  total?: number;
  results?: Array<{ task?: { uuid?: string; url?: string }; verdicts?: Record<string, unknown> }>;
}

export async function lookup(url: string, env: LookupEnv): Promise<SourceResult> {
  if (!env.URLSCAN_API_KEY) {
    return authMissing("urlscan.io", "URLSCAN_API_KEY is not configured");
  }

  const startedAt = Date.now();
  const response = await fetchJson<UrlscanSearchResponse>(
    `https://api.urlscan.io/v1/search/?q=${encodeURIComponent(`page.url:${url}`)}`,
    {
      headers: { "API-Key": env.URLSCAN_API_KEY },
    }
  );

  if (!response.ok) {
    return timedResult("urlscan.io", startedAt, {
      status: "error",
      summary: "urlscan search failed",
      error: response.error,
    });
  }

  const first = response.data.results?.[0];
  return timedResult("urlscan.io", startedAt, {
    status: (response.data.total ?? 0) > 0 ? "ok" : "not_found",
    summary:
      (response.data.total ?? 0) > 0
        ? `${response.data.total} urlscan result(s) found`
        : "No urlscan result found",
    data: response.data.results?.slice(0, 5) ?? [],
    reference_url: first?.task?.uuid ? `https://urlscan.io/result/${first.task.uuid}/` : undefined,
  });
}

