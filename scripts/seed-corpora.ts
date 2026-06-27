import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { parse } from "yaml";
import { slimAttack } from "./slim/attack.js";
import { slimGtfobins } from "./slim/gtfobins.js";
import { slimHijackLibs } from "./slim/hijacklibs.js";
import { slimLolbas } from "./slim/lolbas.js";
import { slimSigmaZip } from "./slim/sigma.js";
import { slimWadcomsZip } from "./slim/wadcoms.js";

type SigmaReleaseAsset = {
  name?: string;
  browser_download_url?: string;
};

const bucket = process.env.R2_BUCKET_NAME ?? "edge-soc-mcp-corpora";
const tempDir = join(process.cwd(), ".tmp", "seed-corpora");
const wadcomsZipUrl = "https://codeload.github.com/WADComs/WADComs.github.io/zip/refs/heads/master";

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.json();
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.text();
}

async function fetchBytes(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return new Uint8Array(await response.arrayBuffer());
}

async function uploadJson(key: string, value: unknown): Promise<void> {
  const path = join(tempDir, key.replaceAll("/", "_"));
  await Bun.write(path, JSON.stringify(value, null, 2));
  const proc = Bun.spawn([
    "bun",
    "x",
    "wrangler",
    "r2",
    "object",
    "put",
    `${bucket}/${key}`,
    "--file",
    path,
    "--remote",
  ], {
    stdout: "inherit",
    stderr: "inherit",
  });
  const code = await proc.exited;
  if (code !== 0) {
    throw new Error(`Failed to upload ${key}`);
  }
}

export function resolveSigmaZipUrl(assets: SigmaReleaseAsset[] | undefined): string {
  const asset = assets?.find((entry) => {
    const name = entry.name?.toLowerCase();
    const url = entry.browser_download_url?.toLowerCase();

    return (
      (name?.startsWith("sigma_all_rules") && name.endsWith(".zip")) ||
      (url?.includes("/sigma_all_rules") && url.endsWith(".zip"))
    );
  });

  if (!asset?.browser_download_url) {
    throw new Error("Could not find latest Sigma release asset");
  }

  return asset.browser_download_url;
}

async function latestSigmaZipUrl(): Promise<string> {
  const release = (await fetchJson("https://api.github.com/repos/SigmaHQ/sigma/releases/latest")) as {
    assets?: SigmaReleaseAsset[];
  };
  return resolveSigmaZipUrl(release.assets);
}

export async function main(): Promise<void> {
  await rm(tempDir, { recursive: true, force: true });
  await mkdir(tempDir, { recursive: true });

  const [lolbasRaw, gtfobinsRaw, gtfobinsMitre, hijackRaw, attackRaw, sigmaZipUrl, wadcomsZip] =
    await Promise.all([
      fetchJson("https://lolbas-project.github.io/api/lolbas.json"),
      fetchJson("https://gtfobins.github.io/api.json"),
      fetchJson("https://gtfobins.github.io/mitre.json"),
      fetchJson("https://hijacklibs.net/api/hijacklibs.json"),
      fetchJson("https://raw.githubusercontent.com/mitre-attack/attack-stix-data/master/enterprise-attack/enterprise-attack.json"),
      latestSigmaZipUrl(),
      fetchBytes(wadcomsZipUrl),
    ]);

  const sigmaZip = await fetchBytes(sigmaZipUrl);
  const d3fendRaw = await fetchJson("https://d3fend.mitre.org/api/offensive-technique/all.json").catch(() => []);

  const corpora = {
    lolbas: slimLolbas(lolbasRaw),
    gtfobins: slimGtfobins(gtfobinsRaw, gtfobinsMitre as Record<string, string[]>),
    hijacklibs: slimHijackLibs(hijackRaw),
    attack: slimAttack(attackRaw),
    sigma: slimSigmaZip(sigmaZip),
    wadcoms: slimWadcomsZip(wadcomsZip),
    d3fend: Array.isArray(d3fendRaw) ? d3fendRaw : [],
  };

  const manifest = {
    generated_at: new Date().toISOString(),
    entries: Object.entries(corpora).map(([name, value]) => ({
      name,
      count: Array.isArray(value) ? value.length : 0,
      fetched_at: new Date().toISOString(),
    })),
  };

  for (const [name, value] of Object.entries(corpora)) {
    await uploadJson(`corpora/${name}.json`, value);
  }
  await uploadJson("corpora/manifest.json", manifest);

  console.log(`[seed-corpora] Uploaded ${manifest.entries.length} corpora to R2 bucket ${bucket}`);
}

if (import.meta.main) {
  await main();
}
