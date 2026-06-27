import { fetchJson } from "../lib/http.js";
import type { SourceResult } from "../types.js";
import { timedResult } from "./common.js";

type PhishTankResponse = Record<string, unknown>;

export async function lookup(url: string): Promise<SourceResult> {
  const startedAt = Date.now();
  const response = await fetchJson<PhishTankResponse>(
    "http://checkurl.phishtank.com/checkurl/",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": "phishtank/edge-soc-mcp",
      },
      body: new URLSearchParams({ url, format: "json" }).toString(),
    }
  );

  if (!response.ok) {
    return timedResult("PhishTank", startedAt, {
      status: response.status === 429 ? "rate_limited" : "error",
      summary: "PhishTank lookup failed",
      error: response.error,
    });
  }

  const payload = JSON.stringify(response.data);
  const confirmed = /valid|phish/i.test(payload);
  return timedResult("PhishTank", startedAt, {
    status: confirmed ? "ok" : "not_found",
    summary: confirmed ? "PhishTank indicates phishing activity" : "No PhishTank hit found",
    data: response.data,
  });
}

