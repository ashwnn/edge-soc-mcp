import type { SourceResult } from "../types.js";
import { loadFeed } from "../corpora/loaders.js";
import { timedResult, type LookupEnv } from "./common.js";

export async function lookup(url: string, env: LookupEnv): Promise<SourceResult> {
  const startedAt = Date.now();
  const entries = env.CORPORA ? await loadFeed<string[]>(env as { CORPORA: R2Bucket }, "openphish", []) : [];
  const found = entries.some((entry) => entry === url);

  return timedResult("OpenPhish", startedAt, {
    status: found ? "cached" : "not_found",
    summary: found ? "URL found in cached OpenPhish feed" : "URL not present in cached OpenPhish feed",
  });
}

