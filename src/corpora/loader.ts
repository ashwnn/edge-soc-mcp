/**
 * R2 corpus loader with warm-isolate memoization.
 *
 * Reads `corpora/<name>.json` from the R2 CORPORA bucket, parses it,
 * and caches the parsed object in-isolate so subsequent requests in the
 * same isolate skip the R2 round-trip.
 *
 * Returns null if the object is missing or cannot be parsed.
 */

import { memo } from "../lib/cache.js";

export interface CorpusManifestEntry {
  name: string;
  fetched_at: string;
  count: number;
  version?: string;
}

export interface CorpusManifest {
  entries: CorpusManifestEntry[];
  generated_at: string;
}

/**
 * Load a named corpus from R2.
 *
 * @param env   Worker environment (needs CORPORA: R2Bucket)
 * @param name  Corpus name without path or extension, e.g. "lolbas"
 */
export async function loadCorpus<T>(
  env: { CORPORA: R2Bucket },
  name: string
): Promise<T | null> {
  const key = `corpus:${name}`;

  // Check in-isolate memo first (synchronous, zero network)
  if (memoHas(key)) {
    return memoGet<T>(key);
  }

  try {
    const obj = await env.CORPORA.get(`corpora/${name}.json`);
    if (obj === null) {
      return null;
    }
    const text = await obj.text();
    const parsed = JSON.parse(text) as T;
    memoSet(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Load the corpus manifest (`corpora/manifest.json`) from R2.
 * Returns null if missing.
 */
export async function loadManifest(env: {
  CORPORA: R2Bucket;
}): Promise<CorpusManifest | null> {
  return loadCorpus<CorpusManifest>(env, "manifest");
}

// ---------------------------------------------------------------------------
// Internal memo helpers (synchronous wrappers around the module-level Map)
// We can't use the generic memo() from cache.ts directly here because
// the R2 fetch is async — we need to check/set synchronously around the await.
// ---------------------------------------------------------------------------

const _cache = new Map<string, unknown>();

function memoHas(key: string): boolean {
  return _cache.has(key);
}

function memoGet<T>(key: string): T {
  return _cache.get(key) as T;
}

function memoSet(key: string, value: unknown): void {
  _cache.set(key, value);
}

// Re-export memo for convenience (used by other corpora modules)
export { memo };
