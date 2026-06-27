import type { SourceResult } from "../types.js";
import { timedResult, type LookupEnv } from "./common.js";

interface KevEntry {
  cveID?: string;
  vendorProject?: string;
  product?: string;
  vulnerabilityName?: string;
  dueDate?: string;
  knownRansomwareCampaignUse?: string;
}

export async function lookup(cve: string, env: LookupEnv): Promise<SourceResult> {
  const startedAt = Date.now();
  const raw = await env.CACHE?.get(`kev:${cve}`, "json");
  const data = (raw as KevEntry | null) ?? null;

  return timedResult("CISA KEV", startedAt, {
    status: data ? "cached" : "not_found",
    summary: data ? "CVE is present in the cached KEV catalog" : "CVE not present in cached KEV catalog",
    data: data ?? undefined,
  });
}

