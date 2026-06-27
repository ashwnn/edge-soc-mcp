import type { Envelope, ObservableType, SourceResult, Verdict } from "../types.js";

export interface ScoreSignalsInput {
  positive?: number;
  negative?: number;
  summary: string;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function uniqStrings(values: readonly string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  );
}

export function collectRestrictions(sources: readonly SourceResult[]): string[] {
  return uniqStrings(sources.flatMap((source) => source.restrictions ?? []));
}

export function scoreFromSignals(input: ScoreSignalsInput): Verdict {
  const positive = input.positive ?? 0;
  const negative = input.negative ?? 0;
  const score = clamp(Math.round(positive - negative), 0, 100);

  let classification: Verdict["classification"] = "unknown";
  if (score >= 85) classification = "malicious";
  else if (score >= 55) classification = "suspicious";
  else if (score <= 20 && negative >= 25) classification = "benign";
  else if (positive <= 15 && negative <= 10) classification = "noise";

  let confidence: Verdict["confidence"] = "low";
  if (classification === "malicious") {
    confidence = score >= 85 ? "high" : "medium";
  } else if (classification === "benign") {
    confidence = negative >= 20 ? "medium" : "low";
  } else if (score >= 35 || negative >= 20) {
    confidence = "medium";
  }

  return {
    classification,
    confidence,
    score,
    summary: input.summary,
  };
}

export function buildAnalystActions(
  classification: Verdict["classification"],
  actions: readonly string[] = []
): string[] {
  const defaults =
    classification === "malicious"
      ? ["Contain or block if confirmed malicious", "Review endpoint telemetry"]
      : classification === "suspicious"
        ? ["Pivot into adjacent telemetry", "Validate with endpoint or proxy logs"]
        : classification === "benign"
          ? ["Document why the activity appears benign"]
          : ["Gather more evidence before making a decision"];

  return uniqStrings([...actions, ...defaults]);
}

export interface BuildEnvelopeInput {
  query: { type: ObservableType; value: string };
  tool: string;
  verdict: Verdict;
  sources: SourceResult[];
  behavior_tags?: string[];
  attack_ids?: string[];
  rule_refs?: string[];
  command_explanation?: string;
  public_exposure_risk?: Envelope["public_exposure_risk"];
  analyst_actions?: string[];
  cache?: Envelope["meta"]["cache"];
  startTime?: number;
  now?: () => number;
}

export function buildEnvelope(input: BuildEnvelopeInput): Envelope {
  const now = input.now ?? (() => Date.now());
  const start = input.startTime ?? now();

  return {
    query: input.query,
    verdict: input.verdict,
    behavior_tags: uniqStrings(input.behavior_tags),
    attack_ids: uniqStrings(input.attack_ids),
    rule_refs: uniqStrings(input.rule_refs),
    command_explanation: input.command_explanation,
    public_exposure_risk: input.public_exposure_risk,
    source_restrictions: collectRestrictions(input.sources),
    analyst_actions: buildAnalystActions(
      input.verdict.classification,
      input.analyst_actions
    ),
    sources: input.sources,
    meta: {
      tool: input.tool,
      generated_at: new Date().toISOString(),
      cache: input.cache ?? "miss",
      elapsed_ms: Math.max(0, now() - start),
    },
  };
}
