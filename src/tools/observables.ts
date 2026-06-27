import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { isCve, isDomain, isHash, isIp, isUrl } from "../lib/validate.js";
import {
  cachedLookup,
  cveSchema,
  domainSchema,
  envelopeResult,
  finalizeEnvelope,
  hashSchema,
  ipSchema,
  summarizeSourceStatuses,
  urlSchema,
  type RuntimeEnv,
} from "../lib/tool.js";
import * as abuseipdb from "../sources/abuseipdb.js";
import * as crtsh from "../sources/crtsh.js";
import * as epss from "../sources/epss.js";
import * as greynoise from "../sources/greynoise.js";
import * as ipinfo from "../sources/ipinfo.js";
import * as kev from "../sources/kev.js";
import * as malwarebazaar from "../sources/malwarebazaar.js";
import * as nvd from "../sources/nvd.js";
import * as openphish from "../sources/openphish.js";
import * as otx from "../sources/otx.js";
import * as phishtank from "../sources/phishtank.js";
import * as pulsedive from "../sources/pulsedive.js";
import * as rdap from "../sources/rdap.js";
import * as shodan from "../sources/shodan.js";
import * as spur from "../sources/spur.js";
import * as sslbl from "../sources/sslbl.js";
import * as threatfox from "../sources/threatfox.js";
import * as urlhaus from "../sources/urlhaus.js";
import * as urlscan from "../sources/urlscan.js";
import * as virustotal from "../sources/virustotal.js";
import * as yaraify from "../sources/yaraify.js";

interface ToolEnv extends RuntimeEnv {
  CORPORA: R2Bucket;
  ABUSE_CH_AUTH_KEY?: string;
  ABUSEIPDB_API_KEY?: string;
  GREYNOISE_API_KEY?: string;
  IPINFO_TOKEN?: string;
  URLSCAN_API_KEY?: string;
  PULSEDIVE_API_KEY?: string;
  OTX_API_KEY?: string;
  NVD_API_KEY?: string;
  SPUR_TOKEN?: string;
  VT_API_KEY?: string;
}

function invalidInput(message: string) {
  return {
    content: [{ type: "text" as const, text: message }],
    structuredContent: { error: message },
    isError: true as const,
  };
}

export function registerObservableTools(server: McpServer, env: ToolEnv): void {
  server.tool(
    "ip_lookup",
    "Enrich an IPv4 or IPv6 address with passive reputation, exposure, and scanner context.",
    ipSchema,
    async ({ ip }) => {
      if (!isIp(ip)) return invalidInput("Expected a valid IPv4 or IPv6 address");

      const envelope = await cachedLookup({
        env,
        tool: "ip_lookup",
        type: "ip",
        value: ip,
        ttlSeconds: 3600,
        execute: async () => {
          const startTime = Date.now();
          const sources = await Promise.all([
            abuseipdb.lookup(ip, env),
            greynoise.lookup(ip, env),
            shodan.lookup(ip),
            ipinfo.lookup(ip, env),
            sslbl.lookupIp(ip, env),
            pulsedive.lookup(ip, env),
            spur.lookup(ip, env),
            virustotal.lookup("ip_addresses", ip, env),
          ]);

          const score = summarizeSourceStatuses(sources);
          if (sources.some((source) => /scanner|noise/i.test(source.summary ?? ""))) {
            score.negative = (score.negative ?? 0) + 10;
          }
          if (sources.some((source) => /abuse confidence|c2|malicious/i.test(source.summary ?? ""))) {
            score.positive = (score.positive ?? 0) + 25;
          }

          return finalizeEnvelope({
            env,
            tool: "ip_lookup",
            query: { type: "ip", value: ip },
            sources,
            score,
            behavior_tags: ["network-enrichment"],
            analyst_actions: ["Pivot on passive DNS", "Review firewall or proxy telemetry"],
            startTime,
          });
        },
      });

      return envelopeResult(envelope);
    }
  );

  server.tool(
    "domain_lookup",
    "Enrich a domain with registration, certificate transparency, and abuse context.",
    domainSchema,
    async ({ domain }) => {
      if (!isDomain(domain)) return invalidInput("Expected a valid domain name");

      const envelope = await cachedLookup({
        env,
        tool: "domain_lookup",
        type: "domain",
        value: domain,
        ttlSeconds: 3600,
        execute: async () => {
          const startTime = Date.now();
          const sources = await Promise.all([
            rdap.lookup(domain),
            crtsh.lookupDomain(domain),
            threatfox.lookup(domain, env),
            urlhaus.lookupHost(domain, env),
            otx.lookup("domain", domain, env),
            pulsedive.lookup(domain, env),
            virustotal.lookup("domains", domain, env),
          ]);

          return finalizeEnvelope({
            env,
            tool: "domain_lookup",
            query: { type: "domain", value: domain },
            sources,
            behavior_tags: ["domain-enrichment"],
            analyst_actions: ["Review WHOIS or RDAP changes", "Check passive DNS history"],
            startTime,
          });
        },
      });

      return envelopeResult(envelope);
    }
  );

  server.tool(
    "url_lookup",
    "Enrich a URL with phishing and malware-delivery context from passive feeds and search APIs.",
    urlSchema,
    async ({ url }) => {
      if (!isUrl(url)) return invalidInput("Expected a valid HTTP or HTTPS URL");

      const envelope = await cachedLookup({
        env,
        tool: "url_lookup",
        type: "url",
        value: url,
        ttlSeconds: 3600,
        execute: async () => {
          const startTime = Date.now();
          const sources = await Promise.all([
            urlhaus.lookupUrl(url, env),
            openphish.lookup(url, env),
            urlscan.lookup(url, env),
            phishtank.lookup(url),
            threatfox.lookup(url, env),
            pulsedive.lookup(url, env),
            virustotal.lookup("urls", url, env),
          ]);

          const score = summarizeSourceStatuses(sources);
          if (sources.some((source) => /phish|malware|urlhaus/i.test(source.summary ?? ""))) {
            score.positive = (score.positive ?? 0) + 25;
          }

          return finalizeEnvelope({
            env,
            tool: "url_lookup",
            query: { type: "url", value: url },
            sources,
            score,
            behavior_tags: ["phishing-risk", "url-enrichment"],
            analyst_actions: ["Check user click telemetry", "Block or detonate only outside this passive workflow"],
            public_exposure_risk: { exposed: false, note: "Lookup uses passive feeds and search APIs only" },
            startTime,
          });
        },
      });

      return envelopeResult(envelope);
    }
  );

  server.tool(
    "hash_lookup",
    "Enrich a file hash with malware, IOC, and rule-match context.",
    hashSchema,
    async ({ hash }) => {
      if (!isHash(hash)) return invalidInput("Expected an MD5, SHA-1, or SHA-256 hash");

      const envelope = await cachedLookup({
        env,
        tool: "hash_lookup",
        type: "hash",
        value: hash,
        ttlSeconds: 3600,
        execute: async () => {
          const startTime = Date.now();
          const sources = await Promise.all([
            malwarebazaar.lookup(hash, env),
            yaraify.lookupHash(hash, env),
            threatfox.lookup(hash, env),
            otx.lookup("file", hash, env),
            virustotal.lookup("files", hash, env),
          ]);

          return finalizeEnvelope({
            env,
            tool: "hash_lookup",
            query: { type: "hash", value: hash },
            sources,
            behavior_tags: ["file-reputation"],
            analyst_actions: ["Search EDR for file prevalence", "Review related process tree"],
            startTime,
          });
        },
      });

      return envelopeResult(envelope);
    }
  );

  server.tool(
    "cve_lookup",
    "Enrich a CVE with NVD detail, EPSS likelihood, and cached CISA KEV presence.",
    cveSchema,
    async ({ cve }) => {
      if (!isCve(cve)) return invalidInput("Expected a valid CVE identifier");

      const normalized = cve.toUpperCase();
      const envelope = await cachedLookup({
        env,
        tool: "cve_lookup",
        type: "cve",
        value: normalized,
        ttlSeconds: 21600,
        execute: async () => {
          const startTime = Date.now();
          const sources = await Promise.all([
            nvd.lookup(normalized, env),
            epss.lookup(normalized),
            kev.lookup(normalized, env),
          ]);

          const score = summarizeSourceStatuses(sources);
          if (sources.some((source) => source.source === "CISA KEV" && source.status !== "not_found")) {
            score.positive = (score.positive ?? 0) + 35;
          }

          return finalizeEnvelope({
            env,
            tool: "cve_lookup",
            query: { type: "cve", value: normalized },
            sources,
            score,
            behavior_tags: ["vulnerability-prioritization"],
            analyst_actions: ["Check asset exposure", "Prioritize patch or mitigation if internet-facing"],
            startTime,
          });
        },
      });

      return envelopeResult(envelope);
    }
  );
}

