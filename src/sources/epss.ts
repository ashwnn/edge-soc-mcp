import { fetchJson } from "../lib/http.js";
import type { SourceResult } from "../types.js";
import { timedResult } from "./common.js";

interface EpssResponse {
  data?: Array<{ cve?: string; epss?: string; percentile?: string; date?: string }>;
}

export async function lookup(cve: string): Promise<SourceResult> {
  const startedAt = Date.now();
  const response = await fetchJson<EpssResponse>(
    `https://api.first.org/data/v1/epss?cve=${encodeURIComponent(cve)}`
  );

  if (!response.ok) {
    return timedResult("EPSS", startedAt, {
      status: "error",
      summary: "EPSS lookup failed",
      error: response.error,
    });
  }

  const item = response.data.data?.[0];
  return timedResult("EPSS", startedAt, {
    status: item ? "ok" : "not_found",
    summary: item
      ? `EPSS ${item.epss ?? "0"} percentile ${item.percentile ?? "0"}`
      : "No EPSS record found",
    data: item,
  });
}
