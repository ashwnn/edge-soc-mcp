import type { LolbasEntry } from "../../src/corpora/search.js";

export function slimGtfobins(raw: unknown, mitreMap?: Record<string, string[]>): LolbasEntry[] {
  if (!raw || typeof raw !== "object") return [];

  return Object.entries(raw as Record<string, unknown>).map(([name, value]) => {
    const record = value as Record<string, unknown>;
    const functions = Array.isArray(record.functions) ? record.functions.map(String) : [];
    const attackIds = mitreMap?.[name] ?? [];

    return {
      name,
      commands: functions.map((fn) => ({
        command: `${name} ${fn}`,
        description: `GTFOBins ${fn} technique`,
        category: fn,
        mitreID: attackIds[0],
      })),
    } satisfies LolbasEntry;
  });
}

