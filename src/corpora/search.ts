export interface LolbasCommand {
  command: string;
  description?: string;
  category?: string;
  mitreID?: string;
}

export interface LolbasEntry {
  name: string;
  paths?: string[];
  commands?: LolbasCommand[];
  detections?: string[];
}

export interface HijackLibEntry {
  dll: string;
  expectedLocations?: string[];
  vulnerableExecutables?: string[];
  type?: string;
}

export interface AttackTechnique {
  id: string;
  name: string;
  tactics?: string[];
  description?: string;
  detection?: string;
  data_sources?: string[];
  platforms?: string[];
  is_subtechnique?: boolean;
  parent?: string;
  url?: string;
}

export interface SigmaRule {
  id: string;
  title: string;
  level?: string;
  status?: string;
  description?: string;
  tags?: string[];
  logsource?: {
    product?: string;
    category?: string;
    service?: string;
  };
  raw_url?: string;
}

export interface WadcomsEntry {
  name: string;
  command?: string;
  os?: string;
  services?: string[];
  attack_types?: string[];
  refs?: string[];
}

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function contains(haystack: string | undefined, needle: string): boolean {
  return typeof haystack === "string" && normalize(haystack).includes(needle);
}

export function findLolbinMatches(
  query: string,
  corpus: readonly LolbasEntry[]
): Array<LolbasEntry & { attack_ids: string[] }> {
  const needle = normalize(query);

  return corpus
    .filter((entry) => {
      return (
        contains(entry.name, needle) ||
        (entry.paths ?? []).some((path) => contains(path, needle) || needle.includes(normalize(path))) ||
        (entry.commands ?? []).some(
          (command) =>
            contains(command.command, needle) || needle.includes(normalize(command.command))
        )
      );
    })
    .map((entry) => ({
      ...entry,
      attack_ids: Array.from(
        new Set(
          (entry.commands ?? [])
            .map((command) => command.mitreID)
            .filter((value): value is string => Boolean(value))
        )
      ),
    }));
}

export function findHijackMatches(
  query: string,
  corpus: readonly HijackLibEntry[]
): HijackLibEntry[] {
  const needle = normalize(query);
  return corpus.filter(
    (entry) =>
      contains(entry.dll, needle) ||
      (entry.vulnerableExecutables ?? []).some((exe) => contains(exe, needle)) ||
      (entry.expectedLocations ?? []).some((location) => contains(location, needle))
  );
}

export function findAttackMatches(
  query: string,
  corpus: readonly AttackTechnique[]
): AttackTechnique[] {
  const needle = normalize(query);
  const exact = corpus.filter((entry) => normalize(entry.id) === needle);
  if (exact.length > 0) return exact;

  return corpus.filter(
    (entry) =>
      contains(entry.id, needle) ||
      contains(entry.name, needle) ||
      contains(entry.description, needle) ||
      (entry.tactics ?? []).some((tactic) => contains(tactic, needle))
  );
}

export function findSigmaMatches(
  query: string,
  corpus: readonly SigmaRule[]
): SigmaRule[] {
  const needle = normalize(query);
  return corpus.filter(
    (rule) =>
      contains(rule.id, needle) ||
      contains(rule.title, needle) ||
      contains(rule.description, needle) ||
      (rule.tags ?? []).some((tag) => contains(tag, needle)) ||
      contains(rule.logsource?.product, needle) ||
      contains(rule.logsource?.category, needle) ||
      contains(rule.logsource?.service, needle)
  );
}

export function summarizeCommandMatches(
  query: string,
  lolbas: readonly LolbasEntry[],
  attack: readonly AttackTechnique[],
  wadcoms: readonly WadcomsEntry[] = []
): string {
  const lolMatches = findLolbinMatches(query, lolbas);
  const attackMatches = findAttackMatches(query, attack);
  const wadMatches = wadcoms.filter(
    (entry) => contains(entry.name, normalize(query)) || contains(entry.command, normalize(query))
  );

  const fragments: string[] = [];

  if (lolMatches[0]) {
    const first = lolMatches[0];
    const attackIds = first.attack_ids.join(", ");
    fragments.push(
      `${first.name} appears in LOLBAS${attackIds ? ` and maps to ${attackIds}` : ""}`
    );
    const command = first.commands?.[0];
    if (command?.description) {
      fragments.push(command.description);
    }
  }

  if (attackMatches[0]) {
    fragments.push(`${attackMatches[0].id} ${attackMatches[0].name}`);
  }

  if (wadMatches[0]) {
    fragments.push(`WADComs also documents related usage for ${wadMatches[0].name}`);
  }

  if (fragments.length === 0) {
    return "No strong corpus match was found for this command.";
  }

  return `${fragments.join(". ")}.`;
}
