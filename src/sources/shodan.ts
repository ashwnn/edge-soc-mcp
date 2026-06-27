import { fetchJson } from "../lib/http.js";
import type { SourceResult } from "../types.js";
import { timedResult } from "./common.js";

interface InternetDbResponse {
  ports?: number[];
  cpes?: string[];
  hostnames?: string[];
  tags?: string[];
  vulns?: string[];
}

export async function lookup(ip: string): Promise<SourceResult> {
  const startedAt = Date.now();
  const response = await fetchJson<InternetDbResponse>(
    `https://internetdb.shodan.io/${encodeURIComponent(ip)}`
  );

  if (!response.ok) {
    return timedResult("Shodan InternetDB", startedAt, {
      status: response.status === 404 ? "not_found" : "error",
      summary: "Shodan InternetDB lookup failed",
      error: response.error,
      restrictions: ["non-commercial use only"],
    });
  }

  return timedResult("Shodan InternetDB", startedAt, {
    status: "ok",
    summary: `${response.data.ports?.length ?? 0} exposed ports visible in InternetDB`,
    data: response.data,
    restrictions: ["non-commercial use only"],
  });
}

