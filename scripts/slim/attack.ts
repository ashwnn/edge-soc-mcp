import type { AttackTechnique } from "../../src/corpora/search.js";

export function slimAttack(raw: unknown): AttackTechnique[] {
  const objects = Array.isArray((raw as { objects?: unknown[] })?.objects)
    ? ((raw as { objects: unknown[] }).objects as unknown[])
    : [];

  return objects
    .filter((item) => (item as Record<string, unknown>).type === "attack-pattern")
    .map((item) => {
      const record = item as Record<string, unknown>;
      const externalRefs = Array.isArray(record.external_references)
        ? (record.external_references as Record<string, unknown>[])
        : [];
      const attackRef = externalRefs.find(
        (ref) => ref.source_name === "mitre-attack" && typeof ref.external_id === "string"
      );
      const phases = Array.isArray(record.kill_chain_phases)
        ? (record.kill_chain_phases as Record<string, unknown>[])
        : [];

      return {
        id: String(attackRef?.external_id ?? ""),
        name: String(record.name ?? ""),
        tactics: phases
          .map((phase) => phase.phase_name)
          .filter((value): value is string => typeof value === "string"),
        description: typeof record.description === "string" ? record.description : undefined,
        data_sources: Array.isArray(record.x_mitre_data_sources)
          ? record.x_mitre_data_sources.map(String)
          : [],
        platforms: Array.isArray(record.x_mitre_platforms)
          ? record.x_mitre_platforms.map(String)
          : [],
        is_subtechnique: Boolean(record.x_mitre_is_subtechnique),
        url: typeof attackRef?.url === "string" ? attackRef.url : undefined,
      } satisfies AttackTechnique;
    })
    .filter((entry) => entry.id && entry.name);
}

