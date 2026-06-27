import { fetchJson, fetchText } from "../lib/http.js";

interface RefreshEnv {
  CACHE: KVNamespace;
  CORPORA: R2Bucket;
}

async function shouldRefresh(
  env: RefreshEnv,
  key: string,
  minIntervalMs: number
): Promise<boolean> {
  const last = await env.CACHE.get(key);
  if (!last) return true;
  const lastMs = Date.parse(last);
  if (Number.isNaN(lastMs)) return true;
  return Date.now() - lastMs >= minIntervalMs;
}

async function markRefreshed(env: RefreshEnv, key: string): Promise<void> {
  await env.CACHE.put(key, new Date().toISOString());
}

export async function refreshKev(env: RefreshEnv): Promise<void> {
  if (!(await shouldRefresh(env, "refresh:kev", 6 * 60 * 60 * 1000))) return;

  const response = await fetchJson<{ vulnerabilities?: Array<Record<string, unknown>> }>(
    "https://www.cisa.gov/sites/default/files/feeds/known_exploited_vulnerabilities.json"
  );
  if (!response.ok) return;

  const vulnerabilities = response.data.vulnerabilities ?? [];
  await Promise.all(
    vulnerabilities.map((entry) =>
      env.CACHE.put(`kev:${String(entry.cveID ?? "")}`, JSON.stringify(entry))
    )
  );
  await env.CACHE.put(
    "kev:meta",
    JSON.stringify({
      count: vulnerabilities.length,
      refreshed_at: new Date().toISOString(),
    })
  );
  await markRefreshed(env, "refresh:kev");
}

async function putFeed(env: RefreshEnv, name: string, value: unknown): Promise<void> {
  await env.CORPORA.put(`corpora/feeds/${name}.json`, JSON.stringify(value));
}

export async function refreshOpenPhish(env: RefreshEnv): Promise<void> {
  if (!(await shouldRefresh(env, "refresh:openphish", 12 * 60 * 60 * 1000))) return;

  const response = await fetchText("https://openphish.com/feed.txt");
  if (!response.ok) return;
  const entries = response.data
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  await putFeed(env, "openphish", entries);
  await markRefreshed(env, "refresh:openphish");
}

async function refreshSslblFeed(
  env: RefreshEnv,
  name: string,
  url: string
): Promise<void> {
  if (!(await shouldRefresh(env, `refresh:${name}`, 6 * 60 * 60 * 1000))) return;

  const response = await fetchText(url);
  if (!response.ok) return;
  const entries = response.data
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));
  await putFeed(env, name, entries);
  await markRefreshed(env, `refresh:${name}`);
}

export async function refreshSslbl(env: RefreshEnv): Promise<void> {
  await Promise.all([
    refreshSslblFeed(env, "sslbl_ips", "https://sslbl.abuse.ch/blacklist/sslipblacklist.csv"),
    refreshSslblFeed(env, "sslbl_ja3", "https://sslbl.abuse.ch/blacklist/ja3_fingerprints.csv"),
    refreshSslblFeed(env, "sslbl_certs", "https://sslbl.abuse.ch/blacklist/sslblacklist.csv"),
  ]);
}

export async function refreshScheduledFeeds(env: RefreshEnv): Promise<void> {
  await Promise.all([refreshKev(env), refreshOpenPhish(env), refreshSslbl(env)]);
}
