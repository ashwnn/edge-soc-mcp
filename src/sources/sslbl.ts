import type { SourceResult } from "../types.js";
import { loadFeed } from "../corpora/loaders.js";
import { timedResult, type LookupEnv } from "./common.js";

export async function lookupIp(ip: string, env: LookupEnv): Promise<SourceResult> {
  const startedAt = Date.now();
  const entries = env.CORPORA ? await loadFeed<string[]>(env as { CORPORA: R2Bucket }, "sslbl_ips", []) : [];
  const found = entries.some((entry) => entry.includes(ip));
  return timedResult("SSLBL", startedAt, {
    status: found ? "cached" : "not_found",
    summary: found ? "IP found in cached SSLBL C2 IP feed" : "IP not present in cached SSLBL C2 IP feed",
    restrictions: ["no automated scanning of the blacklist > 1x/5min"],
  });
}

export async function lookupJa3(ja3: string, env: LookupEnv): Promise<SourceResult> {
  const startedAt = Date.now();
  const entries = env.CORPORA ? await loadFeed<string[]>(env as { CORPORA: R2Bucket }, "sslbl_ja3", []) : [];
  const found = entries.some((entry) => entry.includes(ja3));
  return timedResult("SSLBL", startedAt, {
    status: found ? "cached" : "not_found",
    summary: found ? "JA3 found in cached SSLBL feed" : "JA3 not present in cached SSLBL feed",
    restrictions: ["no automated scanning of the blacklist > 1x/5min"],
  });
}

export async function lookupCert(value: string, env: LookupEnv): Promise<SourceResult> {
  const startedAt = Date.now();
  const entries = env.CORPORA ? await loadFeed<string[]>(env as { CORPORA: R2Bucket }, "sslbl_certs", []) : [];
  const found = entries.some((entry) => entry.includes(value));
  return timedResult("SSLBL", startedAt, {
    status: found ? "cached" : "not_found",
    summary: found ? "Certificate found in cached SSLBL feed" : "Certificate not present in cached SSLBL feed",
    restrictions: ["no automated scanning of the blacklist > 1x/5min"],
  });
}

