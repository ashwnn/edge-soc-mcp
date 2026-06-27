import { fetchJson } from "../lib/http.js";
import type { SourceResult } from "../types.js";
import { authMissing, timedResult, type LookupEnv } from "./common.js";

type UrlhausResponse = Record<string, unknown> & { query_status?: string };

export async function lookupHost(host: string, env: LookupEnv): Promise<SourceResult> {
  if (!env.ABUSE_CH_AUTH_KEY) {
    return authMissing("URLhaus", "ABUSE_CH_AUTH_KEY is not configured");
  }

  const startedAt = Date.now();
  const response = await fetchJson<UrlhausResponse>("https://urlhaus-api.abuse.ch/v1/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Auth-Key": env.ABUSE_CH_AUTH_KEY,
    },
    body: new URLSearchParams({ query: "host", host }).toString(),
  });

  if (!response.ok) {
    return timedResult("URLhaus", startedAt, {
      status: "error",
      summary: "URLhaus host lookup failed",
      error: response.error,
    });
  }

  const found = response.data.query_status && response.data.query_status !== "no_results";
  return timedResult("URLhaus", startedAt, {
    status: found ? "ok" : "not_found",
    summary: found ? "URLhaus host hit found" : "No URLhaus host record found",
    data: response.data,
  });
}

export async function lookupUrl(url: string, env: LookupEnv): Promise<SourceResult> {
  if (!env.ABUSE_CH_AUTH_KEY) {
    return authMissing("URLhaus", "ABUSE_CH_AUTH_KEY is not configured");
  }

  const startedAt = Date.now();
  const response = await fetchJson<UrlhausResponse>("https://urlhaus-api.abuse.ch/v1/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Auth-Key": env.ABUSE_CH_AUTH_KEY,
    },
    body: new URLSearchParams({ query: "url_info", url }).toString(),
  });

  if (!response.ok) {
    return timedResult("URLhaus", startedAt, {
      status: "error",
      summary: "URLhaus URL lookup failed",
      error: response.error,
    });
  }

  const found = response.data.query_status && response.data.query_status !== "no_results";
  return timedResult("URLhaus", startedAt, {
    status: found ? "ok" : "not_found",
    summary: found ? "URLhaus URL hit found" : "No URLhaus URL record found",
    data: response.data,
  });
}

