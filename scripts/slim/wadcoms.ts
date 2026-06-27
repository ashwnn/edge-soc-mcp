import { unzipSync } from "fflate";
import { parse } from "yaml";
import type { WadcomsEntry } from "../../src/corpora/search.js";

export function slimWadcomsZip(zipBytes: Uint8Array): WadcomsEntry[] {
  const archive = unzipSync(zipBytes);
  const entries: WadcomsEntry[] = [];

  for (const [filename, bytes] of Object.entries(archive)) {
    if (!filename.includes("_wadcoms/") || !filename.endsWith(".md")) continue;
    const text = new TextDecoder().decode(bytes);
    const match = text.match(/^---\n([\s\S]*?)\n---/);
    if (!match) continue;
    const frontmatter = parse(match[1]) as Record<string, unknown> | null;
    if (!frontmatter) continue;

    entries.push({
      name: String(frontmatter.name ?? filename),
      command: typeof frontmatter.command === "string" ? frontmatter.command : undefined,
      os: typeof frontmatter.os === "string" ? frontmatter.os : undefined,
      services: Array.isArray(frontmatter.services) ? frontmatter.services.map(String) : [],
      attack_types: Array.isArray(frontmatter.attack_types)
        ? frontmatter.attack_types.map(String)
        : [],
      refs: Array.isArray(frontmatter.references) ? frontmatter.references.map(String) : [],
    });
  }

  return entries;
}

