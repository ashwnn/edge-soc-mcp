import { fetchJson } from "../lib/http.js";
import type { SourceResult } from "../types.js";
import { timedResult, type LookupEnv } from "./common.js";

interface GreyNoiseResponse {
  noise?: boolean;
  riot?: boolean;
  classification?: string;
  name?: string;
  actor?: string;
  link?: string;
}

export async function lookup(ip: string, env: LookupEnv): Promise<SourceResult> {
  const startedAt = Date.now();
  const response = await fetchJson<GreyNoiseResponse>(
    `https://api.greynoise.io/v3/community/${encodeURIComponent(ip)}`,
    {
      headers: env.GREYNOISE_API_KEY ? { key: env.GREYNOISE_API_KEY } : {},
    }
  );

  if (!response.ok) {
    return timedResult("GreyNoise Community", startedAt, {
      status: response.status === 429 ? "rate_limited" : "error",
      summary: "GreyNoise lookup failed",
      error: response.error,
    });
  }

  return timedResult("GreyNoise Community", startedAt, {
    status: "ok",
    summary: response.data.noise
      ? `Internet scanner activity classified as ${response.data.classification ?? "noise"}`
      : response.data.riot
        ? "GreyNoise marks this IP as RIOT benign infrastructure"
        : "GreyNoise has no strong community classification",
    data: response.data,
    reference_url: response.data.link,
  });
}

