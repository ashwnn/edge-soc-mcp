/**
 * HTTP helpers for Workers.
 *
 * - AbortController timeout (default 8000 ms, configurable).
 * - One retry on network error or 5xx.
 * - Default User-Agent header.
 * - Returns a discriminated result — NEVER throws.
 */

const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_USER_AGENT = "edge-soc-mcp/1.0";

export type HttpOk<T> = { ok: true; status: number; data: T };
export type HttpErr = { ok: false; status: number; error: string };
export type HttpResult<T> = HttpOk<T> | HttpErr;

interface FetchOptions extends RequestInit {
  /** Request timeout in ms. Default: 8000. */
  timeoutMs?: number;
}

/**
 * Perform a fetch and return a discriminated result.
 * Retries once on network failure or 5xx response.
 * Never throws.
 */
async function fetchWithRetry(
  url: string,
  opts: FetchOptions = {},
  attempt = 0
): Promise<{ ok: boolean; status: number; text: string }> {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, ...init } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const headers = new Headers(init.headers);
  if (!headers.has("User-Agent")) {
    headers.set("User-Agent", DEFAULT_USER_AGENT);
  }

  try {
    const res = await fetch(url, {
      ...init,
      headers,
      signal: controller.signal,
    });
    const text = await res.text();
    if (!res.ok && res.status >= 500 && attempt === 0) {
      return fetchWithRetry(url, opts, 1);
    }
    return { ok: res.ok, status: res.status, text };
  } catch (err) {
    if (attempt === 0) {
      return fetchWithRetry(url, opts, 1);
    }
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, status: 0, text: msg };
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch a URL and parse the response body as JSON. Never throws. */
export async function fetchJson<T>(
  url: string,
  opts: FetchOptions = {}
): Promise<HttpResult<T>> {
  const result = await fetchWithRetry(url, opts);
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.text };
  }
  try {
    const data = JSON.parse(result.text) as T;
    return { ok: true, status: result.status, data };
  } catch {
    return {
      ok: false,
      status: result.status,
      error: `JSON parse error: ${result.text.slice(0, 200)}`,
    };
  }
}

/** Fetch a URL and return the response body as plain text. Never throws. */
export async function fetchText(
  url: string,
  opts: FetchOptions = {}
): Promise<HttpResult<string>> {
  const result = await fetchWithRetry(url, opts);
  if (!result.ok) {
    return { ok: false, status: result.status, error: result.text };
  }
  return { ok: true, status: result.status, data: result.text };
}
