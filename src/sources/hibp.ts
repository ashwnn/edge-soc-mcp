import { fetchJson, fetchText } from "../lib/http.js";
import { sha1hex } from "../lib/hash.js";
import type { SourceResult } from "../types.js";
import { authMissing, timedResult, type LookupEnv } from "./common.js";

type HibpResponse = Array<Record<string, unknown>>;

export async function lookupBreaches(email: string, env: LookupEnv): Promise<SourceResult> {
  if (!env.HIBP_API_KEY) {
    return authMissing("Have I Been Pwned", "HIBP_API_KEY is not configured");
  }

  const startedAt = Date.now();
  const response = await fetchJson<HibpResponse>(
    `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`,
    {
      headers: { "hibp-api-key": env.HIBP_API_KEY },
    }
  );

  if (!response.ok) {
    return timedResult("Have I Been Pwned", startedAt, {
      status: response.status === 404 ? "not_found" : "error",
      summary: "HIBP breach lookup failed",
      error: response.error,
      restrictions: ["requires paid API key for breach lookup"],
    });
  }

  return timedResult("Have I Been Pwned", startedAt, {
    status: "ok",
    summary: `${response.data.length} breach record(s) returned`,
    data: response.data,
    restrictions: ["requires paid API key for breach lookup"],
  });
}

export async function lookupPassword(password: string): Promise<SourceResult> {
  const startedAt = Date.now();
  const hash = (await sha1hex(password)).toUpperCase();
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const response = await fetchText(
    `https://api.pwnedpasswords.com/range/${prefix}`,
    { headers: { "Add-Padding": "true" } }
  );

  if (!response.ok) {
    return timedResult("HIBP Pwned Passwords", startedAt, {
      status: "error",
      summary: "HIBP password lookup failed",
      error: response.error,
    });
  }

  const match = response.data
    .split("\n")
    .map((line) => line.trim().split(":"))
    .find(([candidate]) => candidate?.toUpperCase() === suffix);
  const count = match?.[1] ? Number(match[1]) : 0;

  return timedResult("HIBP Pwned Passwords", startedAt, {
    status: count > 0 ? "ok" : "not_found",
    summary: count > 0 ? `Password exposed ${count} time(s)` : "Password not found in HIBP corpus",
    data: { exposed_count: count },
  });
}

