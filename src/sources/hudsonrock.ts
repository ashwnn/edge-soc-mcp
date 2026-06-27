import { fetchJson } from "../lib/http.js";
import type { SourceResult } from "../types.js";
import { timedResult } from "./common.js";

type HudsonRockResponse = Record<string, unknown>;

export async function lookupEmail(email: string): Promise<SourceResult> {
  const startedAt = Date.now();
  const response = await fetchJson<HudsonRockResponse>(
    `https://cavalier.hudsonrock.com/api/json/v2/osint-tools/search-by-email?email=${encodeURIComponent(email)}`
  );

  if (!response.ok) {
    return timedResult("Hudson Rock Cavalier", startedAt, {
      status: response.status === 404 ? "not_found" : "error",
      summary: "Hudson Rock email lookup failed",
      error: response.error,
    });
  }

  return timedResult("Hudson Rock Cavalier", startedAt, {
    status: "ok",
    summary: "Hudson Rock exposure data returned",
    data: response.data,
  });
}

export async function lookupUsername(username: string): Promise<SourceResult> {
  const startedAt = Date.now();
  const response = await fetchJson<HudsonRockResponse>(
    `https://cavalier.hudsonrock.com/api/json/v2/osint-tools/search-by-username?username=${encodeURIComponent(username)}`
  );

  if (!response.ok) {
    return timedResult("Hudson Rock Cavalier", startedAt, {
      status: response.status === 404 ? "not_found" : "error",
      summary: "Hudson Rock username lookup failed",
      error: response.error,
    });
  }

  return timedResult("Hudson Rock Cavalier", startedAt, {
    status: "ok",
    summary: "Hudson Rock exposure data returned",
    data: response.data,
  });
}

export async function lookupDomain(domain: string): Promise<SourceResult> {
  const startedAt = Date.now();
  const response = await fetchJson<HudsonRockResponse>(
    `https://cavalier.hudsonrock.com/api/json/v2/osint-tools/search-by-domain?domain=${encodeURIComponent(domain)}`
  );

  if (!response.ok) {
    return timedResult("Hudson Rock Cavalier", startedAt, {
      status: response.status === 404 ? "not_found" : "error",
      summary: "Hudson Rock domain lookup failed",
      error: response.error,
    });
  }

  return timedResult("Hudson Rock Cavalier", startedAt, {
    status: "ok",
    summary: "Hudson Rock exposure data returned",
    data: response.data,
  });
}

