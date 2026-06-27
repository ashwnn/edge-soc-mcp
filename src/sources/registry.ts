/**
 * Source registry - metadata for every data source.
 *
 * This file is pure metadata; it does NOT perform any network lookups.
 * Actual lookups live in src/sources/<name>.ts (implemented in P1+).
 */

import type { ObservableType } from "../types.js";

export interface SourceMeta {
  /** Short identifier matching the source module filename */
  name: string;
  /** Human-readable label for display */
  label: string;
  /** Name of the env var holding the API key, if any */
  keyEnvVar?: string;
  /** Legal/usage restrictions to surface in the envelope */
  restrictions: string[];
  /** Whether this source requires a commercial license for production use */
  commercial: boolean;
  /** Observable types this source can enrich */
  appliesTo: ObservableType[];
  /** Whether this source is on by default (false = only when key is present) */
  defaultEnabled: boolean;
}

export const SOURCES: SourceMeta[] = [
  // --- IP ---
  {
    name: "abuseipdb",
    label: "AbuseIPDB",
    keyEnvVar: "ABUSEIPDB_API_KEY",
    restrictions: ["non-commercial use only on free tier"],
    commercial: false,
    appliesTo: ["ip"],
    defaultEnabled: false,
  },
  {
    name: "greynoise",
    label: "GreyNoise Community",
    keyEnvVar: "GREYNOISE_API_KEY",
    restrictions: [],
    commercial: false,
    appliesTo: ["ip"],
    defaultEnabled: true, // community tier is keyless
  },
  {
    name: "shodan",
    label: "Shodan InternetDB",
    restrictions: [],
    commercial: false,
    appliesTo: ["ip"],
    defaultEnabled: true, // InternetDB is keyless
  },
  {
    name: "ipinfo",
    label: "IPinfo Lite",
    keyEnvVar: "IPINFO_TOKEN",
    restrictions: [],
    commercial: false,
    appliesTo: ["ip"],
    defaultEnabled: false,
  },
  {
    name: "sslbl",
    label: "SSLBL (abuse.ch)",
    restrictions: ["no automated scanning of the blacklist > 1x/5min"],
    commercial: false,
    appliesTo: ["ip", "cert", "ja3"],
    defaultEnabled: true, // cached feed
  },
  {
    name: "pulsedive",
    label: "Pulsedive",
    keyEnvVar: "PULSEDIVE_API_KEY",
    restrictions: [],
    commercial: false,
    appliesTo: ["ip", "domain", "url"],
    defaultEnabled: false,
  },
  {
    name: "spur",
    label: "Spur Context",
    keyEnvVar: "SPUR_TOKEN",
    restrictions: ["paid tier only"],
    commercial: true,
    appliesTo: ["ip"],
    defaultEnabled: false,
  },
  {
    name: "virustotal",
    label: "VirusTotal",
    keyEnvVar: "VT_API_KEY",
    restrictions: ["non-commercial use only"],
    commercial: false,
    appliesTo: ["ip", "domain", "url", "hash"],
    defaultEnabled: false,
  },
  // --- Domain ---
  {
    name: "rdap",
    label: "RDAP (rdap.org)",
    restrictions: [],
    commercial: false,
    appliesTo: ["domain"],
    defaultEnabled: true,
  },
  {
    name: "crtsh",
    label: "crt.sh",
    restrictions: [],
    commercial: false,
    appliesTo: ["domain", "cert"],
    defaultEnabled: true,
  },
  {
    name: "threatfox",
    label: "ThreatFox (abuse.ch)",
    keyEnvVar: "ABUSE_CH_AUTH_KEY",
    restrictions: [],
    commercial: false,
    appliesTo: ["domain", "hash", "ip", "url"],
    defaultEnabled: false,
  },
  {
    name: "urlhaus",
    label: "URLhaus (abuse.ch)",
    keyEnvVar: "ABUSE_CH_AUTH_KEY",
    restrictions: [],
    commercial: false,
    appliesTo: ["domain", "url"],
    defaultEnabled: false,
  },
  {
    name: "otx",
    label: "AlienVault OTX",
    keyEnvVar: "OTX_API_KEY",
    restrictions: [],
    commercial: false,
    appliesTo: ["domain", "hash"],
    defaultEnabled: false,
  },
  // --- URL ---
  {
    name: "openphish",
    label: "OpenPhish",
    restrictions: [],
    commercial: false,
    appliesTo: ["url"],
    defaultEnabled: true, // cached feed
  },
  {
    name: "urlscan",
    label: "urlscan.io",
    keyEnvVar: "URLSCAN_API_KEY",
    restrictions: [],
    commercial: false,
    appliesTo: ["url"],
    defaultEnabled: false,
  },
  // --- Hash ---
  {
    name: "malwarebazaar",
    label: "MalwareBazaar (abuse.ch)",
    keyEnvVar: "ABUSE_CH_AUTH_KEY",
    restrictions: [],
    commercial: false,
    appliesTo: ["hash"],
    defaultEnabled: false,
  },
  {
    name: "yaraify",
    label: "YARAify (abuse.ch)",
    keyEnvVar: "ABUSE_CH_AUTH_KEY",
    restrictions: [],
    commercial: false,
    appliesTo: ["hash"],
    defaultEnabled: false,
  },
  // --- CVE ---
  {
    name: "nvd",
    label: "NVD",
    keyEnvVar: "NVD_API_KEY",
    restrictions: [],
    commercial: false,
    appliesTo: ["cve"],
    defaultEnabled: true,
  },
  {
    name: "epss",
    label: "EPSS (FIRST.org)",
    restrictions: [],
    commercial: false,
    appliesTo: ["cve"],
    defaultEnabled: true,
  },
  {
    name: "kev",
    label: "CISA KEV",
    restrictions: [],
    commercial: false,
    appliesTo: ["cve"],
    defaultEnabled: true, // cached feed
  },
  // --- Account exposure ---
  {
    name: "hudsonrock",
    label: "Hudson Rock Cavalier",
    keyEnvVar: "HUDSONROCK_API_KEY",
    restrictions: [],
    commercial: false,
    appliesTo: ["email", "username", "domain"],
    defaultEnabled: true, // keyless OSINT endpoints
  },
  {
    name: "hibp",
    label: "Have I Been Pwned",
    keyEnvVar: "HIBP_API_KEY",
    restrictions: ["requires paid API key for breach lookup"],
    commercial: true,
    appliesTo: ["email"],
    defaultEnabled: false,
  },
  // --- DoH ---
  {
    name: "doh",
    label: "DNS over HTTPS",
    restrictions: [],
    commercial: false,
    appliesTo: ["domain", "hostname"],
    defaultEnabled: true,
  },
];

/**
 * Returns all source metadata entries that apply to a given observable type.
 */
export function sourcesFor(type: ObservableType): SourceMeta[] {
  return SOURCES.filter((s) => s.appliesTo.includes(type));
}

/**
 * Returns true if the source's required API key is present in env.
 * For sources with no keyEnvVar, returns true if defaultEnabled.
 */
export function hasKey(
  env: Record<string, string | undefined>,
  source: SourceMeta
): boolean {
  if (!source.keyEnvVar) {
    return source.defaultEnabled;
  }
  return typeof env[source.keyEnvVar] === "string" && env[source.keyEnvVar] !== "";
}
