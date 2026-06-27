import { unzipSync } from "fflate";
import { parse } from "yaml";
import type { SigmaRule } from "../../src/corpora/search.js";

export function slimSigmaZip(zipBytes: Uint8Array): SigmaRule[] {
  const archive = unzipSync(zipBytes);
  const rules: SigmaRule[] = [];

  for (const [filename, bytes] of Object.entries(archive)) {
    if (!filename.endsWith(".yml") && !filename.endsWith(".yaml")) continue;

    const text = new TextDecoder().decode(bytes);
    const parsed = parse(text) as Record<string, unknown> | null;
    if (!parsed) continue;

    const tags = Array.isArray(parsed.tags) ? parsed.tags.map(String) : [];
    const logsource =
      parsed.logsource && typeof parsed.logsource === "object"
        ? (parsed.logsource as Record<string, unknown>)
        : {};

    rules.push({
      id: String(parsed.id ?? filename),
      title: String(parsed.title ?? filename),
      status: typeof parsed.status === "string" ? parsed.status : undefined,
      level: typeof parsed.level === "string" ? parsed.level : undefined,
      description: typeof parsed.description === "string" ? parsed.description : undefined,
      tags,
      logsource: {
        product: typeof logsource.product === "string" ? logsource.product : undefined,
        category: typeof logsource.category === "string" ? logsource.category : undefined,
        service: typeof logsource.service === "string" ? logsource.service : undefined,
      },
      raw_url: `https://raw.githubusercontent.com/SigmaHQ/sigma/master/${filename}`,
    });
  }

  return rules;
}

