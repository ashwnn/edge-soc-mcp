/**
 * KV caching helpers and warm-isolate in-memory memo.
 */

import { sha256hex } from "./hash.js";

// ---------------------------------------------------------------------------
// In-memory memo — persists for the lifetime of a warm isolate.
// Used to avoid re-parsing large R2 corpora on every request.
// ---------------------------------------------------------------------------

const memoStore = new Map<string, unknown>();

/**
 * Memo: if key is in the in-memory store, return it; otherwise call fn,
 * store the result, and return it.
 *
 * The store is module-level so it survives across requests within the same
 * isolate lifetime. It is cleared on isolate restart.
 */
export function memo<T>(key: string, fn: () => T): T {
  if (memoStore.has(key)) {
    return memoStore.get(key) as T;
  }
  const value = fn();
  memoStore.set(key, value);
  return value;
}

// ---------------------------------------------------------------------------
// KV cache
// ---------------------------------------------------------------------------

/**
 * Derive a cache key: `v1:{tool}:{type}:{sha256hex(value)}`.
 * The hex truncation keeps keys short while remaining collision-resistant.
 */
export async function cacheKey(
  tool: string,
  type: string,
  value: string
): Promise<string> {
  const hex = await sha256hex(value);
  return `v1:${tool}:${type}:${hex}`;
}

/**
 * KV cache-aside helper.
 *
 * 1. GET the key from KV; if present, parse and return the cached value.
 * 2. Otherwise call `fn()`, PUT the result with `expirationTtl`, return it.
 *
 * Never throws — if KV operations fail, falls through to `fn()`.
 */
export async function withCache<T>(
  kv: KVNamespace,
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T> {
  try {
    const cached = await kv.get(key, "text");
    if (cached !== null) {
      return JSON.parse(cached) as T;
    }
  } catch {
    // KV read failure — proceed to fn()
  }

  const value = await fn();

  try {
    await kv.put(key, JSON.stringify(value), {
      expirationTtl: ttlSeconds,
    });
  } catch {
    // KV write failure is non-fatal
  }

  return value;
}
