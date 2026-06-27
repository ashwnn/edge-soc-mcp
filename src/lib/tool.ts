import { z } from "zod";
import type { Envelope, ObservableType, SourceResult } from "../types.js";
import { buildEnvelope, scoreFromSignals, type ScoreSignalsInput } from "./envelope.js";
import { cacheKey, withCache } from "./cache.js";
import { logAudit } from "./audit.js";
import { sha256hex } from "./hash.js";

export interface RuntimeEnv {
  CACHE: KVNamespace;
  DB?: D1Database;
}

export function envelopeResult(envelope: Envelope) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(envelope, null, 2) }],
    structuredContent: envelope,
  };
}

export function sourceSummaryStatus(source: SourceResult): number {
  if (source.status === "ok") return 20;
  if (source.status === "cached") return 15;
  if (source.status === "rate_limited") return 6;
  if (source.status === "error") return 3;
  return 0;
}

export async function cachedLookup(params: {
  env: RuntimeEnv;
  tool: string;
  type: ObservableType;
  value: string;
  ttlSeconds: number;
  execute: () => Promise<Envelope>;
}): Promise<Envelope> {
  const key = await cacheKey(params.tool, params.type, params.value);
  return withCache(params.env.CACHE, key, params.ttlSeconds, params.execute);
}

export function summarizeSourceStatuses(sources: readonly SourceResult[]): ScoreSignalsInput {
  let positive = 0;
  let negative = 0;

  for (const source of sources) {
    positive += sourceSummaryStatus(source);
    if (source.status === "ok" && /malicious|phish|abuse|botnet|c2|scanner/i.test(source.summary ?? "")) {
      positive += 12;
    }
    if (source.status === "ok" && /benign|clean|no record|no sightings/i.test(source.summary ?? "")) {
      negative += 12;
    }
  }

  const okCount = sources.filter((source) => source.status === "ok").length;
  const errorCount = sources.filter((source) => source.status === "error").length;

  return {
    positive,
    negative,
    summary:
      okCount > 0
        ? `${okCount} source${okCount === 1 ? "" : "s"} returned enrichment${
            errorCount > 0 ? `; ${errorCount} had errors` : ""
          }`
        : "No source returned decisive evidence",
  };
}

export async function finalizeEnvelope(params: {
  env: RuntimeEnv;
  tool: string;
  query: { type: ObservableType; value: string };
  sources: SourceResult[];
  behavior_tags?: string[];
  attack_ids?: string[];
  rule_refs?: string[];
  analyst_actions?: string[];
  command_explanation?: string;
  public_exposure_risk?: Envelope["public_exposure_risk"];
  score?: ScoreSignalsInput;
  cache?: Envelope["meta"]["cache"];
  startTime?: number;
}): Promise<Envelope> {
  const verdict = scoreFromSignals(params.score ?? summarizeSourceStatuses(params.sources));
  const envelope = buildEnvelope({
    query: params.query,
    tool: params.tool,
    verdict,
    sources: params.sources,
    behavior_tags: params.behavior_tags,
    attack_ids: params.attack_ids,
    rule_refs: params.rule_refs,
    analyst_actions: params.analyst_actions,
    command_explanation: params.command_explanation,
    public_exposure_risk: params.public_exposure_risk,
    cache: params.cache,
    startTime: params.startTime,
  });

  await logAudit(params.env, {
    tool: params.tool,
    query_type: params.query.type,
    query_hash: await sha256hex(params.query.value),
    classification: envelope.verdict.classification,
    timestamp: envelope.meta.generated_at,
    sources_used: params.sources
      .filter((source) => source.status === "ok" || source.status === "cached")
      .map((source) => source.source),
  });

  return envelope;
}

export const ipSchema = { ip: z.string().describe("IPv4 or IPv6 address") };
export const domainSchema = { domain: z.string().describe("Domain name") };
export const urlSchema = { url: z.string().describe("HTTP or HTTPS URL") };
export const hashSchema = { hash: z.string().describe("MD5, SHA-1, or SHA-256 hash") };
export const cveSchema = { cve: z.string().describe("CVE identifier like CVE-2024-12345") };

