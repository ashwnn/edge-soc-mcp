import type { LolbasEntry } from "../../src/corpora/search.js";

export function slimLolbas(raw: unknown): LolbasEntry[] {
  if (!Array.isArray(raw)) return [];

  return raw
    .map((entry) => {
      const record = entry as Record<string, unknown>;
      const commands = Array.isArray(record.Commands)
        ? record.Commands.map((command) => {
            const item = command as Record<string, unknown>;
            return {
              command: String(item.Command ?? ""),
              description: typeof item.Description === "string" ? item.Description : undefined,
              category: typeof item.Category === "string" ? item.Category : undefined,
              mitreID: typeof item.MitreID === "string" ? item.MitreID : undefined,
            };
          }).filter((command) => command.command)
        : [];

      return {
        name: String(record.Name ?? record.name ?? ""),
        paths: Array.isArray(record.Full_Path) ? record.Full_Path.map(String) : [],
        commands,
        detections: Array.isArray(record.Detection) ? record.Detection.map(String) : [],
      } satisfies LolbasEntry;
    })
    .filter((entry) => entry.name);
}

