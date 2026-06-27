import { fetchJson } from "../lib/http.js";
import type { SourceResult } from "../types.js";
import { timedResult } from "./common.js";

interface DohResponse {
  Status?: number;
  Answer?: Array<{ name?: string; type?: number; data?: string; TTL?: number }>;
}

export async function lookup(
  name: string,
  type = "A",
  provider: "cloudflare" | "google" = "cloudflare"
): Promise<SourceResult> {
  const startedAt = Date.now();
  const base =
    provider === "cloudflare"
      ? "https://cloudflare-dns.com/dns-query"
      : "https://dns.google/resolve";
  const response = await fetchJson<DohResponse>(
    `${base}?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`,
    {
      headers:
        provider === "cloudflare"
          ? { Accept: "application/dns-json" }
          : {},
    }
  );

  if (!response.ok) {
    return timedResult(`DoH ${provider}`, startedAt, {
      status: "error",
      summary: "DoH lookup failed",
      error: response.error,
    });
  }

  return timedResult(`DoH ${provider}`, startedAt, {
    status: (response.data.Answer?.length ?? 0) > 0 ? "ok" : "not_found",
    summary:
      (response.data.Answer?.length ?? 0) > 0
        ? `${response.data.Answer?.length} DNS answer(s) returned`
        : "No DNS answers returned",
    data: response.data.Answer ?? [],
  });
}

