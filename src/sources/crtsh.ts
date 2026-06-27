import { fetchJson } from "../lib/http.js";
import type { SourceResult } from "../types.js";
import { timedResult } from "./common.js";

type CrtShEntry = Record<string, string | number | null>;

export async function lookupDomain(domain: string): Promise<SourceResult> {
  const startedAt = Date.now();
  const response = await fetchJson<CrtShEntry[]>(
    `https://crt.sh/?q=${encodeURIComponent(`%.${domain}`)}&output=json`
  );

  if (!response.ok) {
    return timedResult("crt.sh", startedAt, {
      status: "error",
      summary: "crt.sh lookup failed",
      error: response.error,
    });
  }

  const entries = response.data.slice(0, 10);
  if (entries.length === 0) {
    return timedResult("crt.sh", startedAt, {
      status: "not_found",
      summary: "No certificate transparency hits found",
    });
  }

  return timedResult("crt.sh", startedAt, {
    status: "ok",
    summary: `${entries.length}+ certificate transparency entries found`,
    data: entries,
    reference_url: `https://crt.sh/?q=${encodeURIComponent(domain)}`,
  });
}

export async function lookupCert(cert: string): Promise<SourceResult> {
  const startedAt = Date.now();
  const response = await fetchJson<CrtShEntry[]>(
    `https://crt.sh/?q=${encodeURIComponent(cert)}&output=json`
  );

  if (!response.ok) {
    return timedResult("crt.sh", startedAt, {
      status: "error",
      summary: "crt.sh certificate lookup failed",
      error: response.error,
    });
  }

  return timedResult("crt.sh", startedAt, {
    status: response.data.length ? "ok" : "not_found",
    summary: response.data.length
      ? `${response.data.length}+ certificate entries found`
      : "No certificate transparency hits found",
    data: response.data.slice(0, 10),
  });
}
