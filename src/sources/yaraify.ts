import { fetchJson } from "../lib/http.js";
import type { SourceResult } from "../types.js";
import { authMissing, timedResult, type LookupEnv } from "./common.js";

type YaraifyResponse = Record<string, unknown> & { query_status?: string };

export async function lookupHash(hash: string, env: LookupEnv): Promise<SourceResult> {
  if (!env.ABUSE_CH_AUTH_KEY) {
    return authMissing("YARAify", "ABUSE_CH_AUTH_KEY is not configured");
  }

  const startedAt = Date.now();
  const response = await fetchJson<YaraifyResponse>("https://yaraify-api.abuse.ch/api/v1/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Auth-Key": env.ABUSE_CH_AUTH_KEY,
    },
    body: JSON.stringify({
      query: "lookup_hash",
      search_term: hash,
    }),
  });

  if (!response.ok) {
    return timedResult("YARAify", startedAt, {
      status: "error",
      summary: "YARAify lookup failed",
      error: response.error,
    });
  }

  const found = response.data.query_status && response.data.query_status !== "no_results";
  return timedResult("YARAify", startedAt, {
    status: found ? "ok" : "not_found",
    summary: found ? "YARAify rule hit found" : "No YARAify hit found",
    data: response.data,
  });
}

