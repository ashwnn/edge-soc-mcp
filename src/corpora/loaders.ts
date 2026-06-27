import { loadCorpus } from "./loader.js";
import type {
  AttackTechnique,
  HijackLibEntry,
  LolbasEntry,
  SigmaRule,
  WadcomsEntry,
} from "./search.js";

export async function loadLolbas(env: { CORPORA: R2Bucket }): Promise<LolbasEntry[]> {
  return (await loadCorpus<LolbasEntry[]>(env, "lolbas")) ?? [];
}

export async function loadGtfobins(env: { CORPORA: R2Bucket }): Promise<LolbasEntry[]> {
  return (await loadCorpus<LolbasEntry[]>(env, "gtfobins")) ?? [];
}

export async function loadHijackLibs(
  env: { CORPORA: R2Bucket }
): Promise<HijackLibEntry[]> {
  return (await loadCorpus<HijackLibEntry[]>(env, "hijacklibs")) ?? [];
}

export async function loadAttackTechniques(
  env: { CORPORA: R2Bucket }
): Promise<AttackTechnique[]> {
  return (await loadCorpus<AttackTechnique[]>(env, "attack")) ?? [];
}

export async function loadSigmaRules(env: { CORPORA: R2Bucket }): Promise<SigmaRule[]> {
  return (await loadCorpus<SigmaRule[]>(env, "sigma")) ?? [];
}

export async function loadWadcoms(env: { CORPORA: R2Bucket }): Promise<WadcomsEntry[]> {
  return (await loadCorpus<WadcomsEntry[]>(env, "wadcoms")) ?? [];
}

export async function loadD3fend(env: { CORPORA: R2Bucket }): Promise<AttackTechnique[]> {
  return (await loadCorpus<AttackTechnique[]>(env, "d3fend")) ?? [];
}

export async function loadFeed<T>(
  env: { CORPORA: R2Bucket },
  name: string,
  fallback: T
): Promise<T> {
  return (await loadCorpus<T>(env, `feeds/${name}`)) ?? fallback;
}
