import type { HijackLibEntry } from "../../src/corpora/search.js";

export function slimHijackLibs(raw: unknown): HijackLibEntry[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => {
      const record = entry as Record<string, unknown>;
      return {
        dll: String(record.dll ?? record.DLL ?? ""),
        expectedLocations: Array.isArray(record.expectedLocations)
          ? record.expectedLocations.map(String)
          : [],
        vulnerableExecutables: Array.isArray(record.vulnerableExecutables)
          ? record.vulnerableExecutables.map(String)
          : [],
        type: typeof record.type === "string" ? record.type : undefined,
      } satisfies HijackLibEntry;
    })
    .filter((entry) => entry.dll);
}

