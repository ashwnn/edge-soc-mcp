import { fetchJson } from "../lib/http.js";
import type { SourceResult } from "../types.js";
import { timedResult } from "./common.js";

interface RdapResponse {
  ldhName?: string;
  unicodeName?: string;
  status?: string[];
  events?: Array<{ eventAction?: string; eventDate?: string }>;
  nameservers?: Array<{ ldhName?: string }>;
}

export async function lookup(domain: string): Promise<SourceResult> {
  const startedAt = Date.now();
  const response = await fetchJson<RdapResponse>(
    `https://rdap.org/domain/${encodeURIComponent(domain)}`
  );

  if (!response.ok) {
    return timedResult("RDAP", startedAt, {
      status: response.status === 404 ? "not_found" : "error",
      summary: "RDAP lookup failed",
      error: response.error,
    });
  }

  return timedResult("RDAP", startedAt, {
    status: "ok",
    summary: `RDAP record found for ${response.data.ldhName ?? domain}`,
    data: {
      domain: response.data.ldhName ?? response.data.unicodeName ?? domain,
      statuses: response.data.status ?? [],
      nameservers: (response.data.nameservers ?? []).map((entry) => entry.ldhName).filter(Boolean),
      events: response.data.events ?? [],
    },
    reference_url: `https://rdap.org/domain/${encodeURIComponent(domain)}`,
  });
}

