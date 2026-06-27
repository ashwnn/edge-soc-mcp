import { describe, expect, test } from "bun:test";
import {
  buildAnalystActions,
  buildEnvelope,
  collectRestrictions,
  scoreFromSignals,
} from "../src/lib/envelope.js";
import {
  findAttackMatches,
  findLolbinMatches,
  findSigmaMatches,
  summarizeCommandMatches,
  type AttackTechnique,
  type LolbasEntry,
  type SigmaRule,
} from "../src/corpora/search.js";

describe("scoreFromSignals", () => {
  test("prefers malicious when high-risk signals stack", () => {
    const verdict = scoreFromSignals({
      positive: 88,
      negative: 0,
      summary: "Multiple malicious-source hits",
    });

    expect(verdict.classification).toBe("malicious");
    expect(verdict.confidence).toBe("high");
    expect(verdict.score).toBeGreaterThanOrEqual(85);
  });

  test("returns benign when negative signals outweigh positives", () => {
    const verdict = scoreFromSignals({
      positive: 10,
      negative: 60,
      summary: "Mostly benign context",
    });

    expect(verdict.classification).toBe("benign");
    expect(verdict.confidence).toBe("medium");
  });
});

describe("collectRestrictions", () => {
  test("deduplicates and sorts source restrictions", () => {
    const restrictions = collectRestrictions([
      { source: "A", status: "ok", restrictions: ["non-commercial", "cache required"] },
      { source: "B", status: "ok", restrictions: ["cache required"] },
    ]);

    expect(restrictions).toEqual(["cache required", "non-commercial"]);
  });
});

describe("buildEnvelope", () => {
  test("normalizes source restrictions and analyst actions", () => {
    const envelope = buildEnvelope({
      query: { type: "ip", value: "1.1.1.1" },
      tool: "ip_lookup",
      sources: [
        { source: "AbuseIPDB", status: "ok", restrictions: ["non-commercial"] },
        { source: "GreyNoise", status: "ok" },
      ],
      verdict: scoreFromSignals({
        positive: 64,
        summary: "Reputation and scan telemetry indicate suspicious behavior",
      }),
      analyst_actions: ["Pivot on passive DNS", "Review firewall logs", "Pivot on passive DNS"],
      attack_ids: ["T1595", "T1595"],
      rule_refs: ["rule-1"],
      behavior_tags: ["scanner-noise", "scanner-noise"],
      startTime: 100,
      now: () => 145,
    });

    expect(envelope.source_restrictions).toEqual(["non-commercial"]);
    expect(envelope.analyst_actions).toEqual([
      "Pivot into adjacent telemetry",
      "Pivot on passive DNS",
      "Review firewall logs",
      "Validate with endpoint or proxy logs",
    ]);
    expect(envelope.attack_ids).toEqual(["T1595"]);
    expect(envelope.behavior_tags).toEqual(["scanner-noise"]);
    expect(envelope.meta.elapsed_ms).toBe(45);
  });
});

describe("buildAnalystActions", () => {
  test("adds defaults for actionable malicious results", () => {
    const actions = buildAnalystActions("malicious", [
      "Review endpoint telemetry",
      "Review endpoint telemetry",
    ]);

    expect(actions).toContain("Review endpoint telemetry");
    expect(actions).toContain("Contain or block if confirmed malicious");
  });
});

describe("corpus search helpers", () => {
  const lolbas: LolbasEntry[] = [
    {
      name: "rundll32.exe",
      paths: ["C:\\Windows\\System32\\rundll32.exe"],
      commands: [
        {
          command: "rundll32.exe javascript:\"\\..\\mshtml,RunHTMLApplication\"",
          description: "Executes script via LOLBAS",
          category: "Execute",
          mitreID: "T1218.011",
        },
      ],
      detections: ["Command-line monitoring"],
    },
  ];

  const attacks: AttackTechnique[] = [
    {
      id: "T1218.011",
      name: "Rundll32",
      tactics: ["defense-evasion"],
      description: "Signed binary proxy execution.",
      platforms: ["Windows"],
      data_sources: ["Process monitoring"],
      url: "https://attack.mitre.org/techniques/T1218/011/",
    },
  ];

  const sigma: SigmaRule[] = [
    {
      id: "sig-1",
      title: "Suspicious Rundll32 Invocation",
      level: "high",
      status: "stable",
      description: "Detects scriptlet-style rundll32 usage.",
      tags: ["attack.t1218.011"],
      logsource: { category: "process_creation", product: "windows" },
      raw_url: "https://example.invalid/rule.yml",
    },
  ];

  test("findLolbinMatches checks names, paths, and commands", () => {
    const matches = findLolbinMatches(
      "C:\\Windows\\System32\\rundll32.exe javascript:\"\\..\\mshtml,RunHTMLApplication\"",
      lolbas
    );

    expect(matches).toHaveLength(1);
    expect(matches[0]?.attack_ids).toContain("T1218.011");
  });

  test("findAttackMatches prefers exact ATT&CK id hits", () => {
    const matches = findAttackMatches("T1218.011", attacks);

    expect(matches).toHaveLength(1);
    expect(matches[0]?.id).toBe("T1218.011");
  });

  test("findSigmaMatches resolves by ATT&CK id and product", () => {
    const attackMatches = findSigmaMatches("T1218.011", sigma);
    const productMatches = findSigmaMatches("windows", sigma);

    expect(attackMatches).toHaveLength(1);
    expect(productMatches).toHaveLength(1);
  });

  test("summarizeCommandMatches builds a concise explanation", () => {
    const explanation = summarizeCommandMatches(
      "rundll32.exe javascript:\"\\..\\mshtml,RunHTMLApplication\"",
      lolbas,
      attacks
    );

    expect(explanation).toContain("rundll32.exe");
    expect(explanation).toContain("T1218.011");
  });
});
