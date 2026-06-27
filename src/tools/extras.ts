import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadD3fend } from "../corpora/loaders.js";
import { findAttackMatches } from "../corpora/search.js";
import { envelopeResult, finalizeEnvelope, type RuntimeEnv } from "../lib/tool.js";
import { isDomain, isEmail } from "../lib/validate.js";
import * as crtsh from "../sources/crtsh.js";
import * as doh from "../sources/doh.js";
import * as hibp from "../sources/hibp.js";
import * as hudsonrock from "../sources/hudsonrock.js";
import * as sslbl from "../sources/sslbl.js";
import * as yaraify from "../sources/yaraify.js";

interface ToolEnv extends RuntimeEnv {
  CORPORA: R2Bucket;
  HIBP_API_KEY?: string;
  ABUSE_CH_AUTH_KEY?: string;
}

export function registerExtraTools(server: McpServer, env: ToolEnv): void {
  server.tool(
    "account_exposure",
    "Check user or domain exposure with Hudson Rock and optional HIBP data.",
    { value: z.string().describe("Email, username, or domain") },
    async ({ value }) => {
      const startTime = Date.now();
      const sources = await Promise.all([
        isEmail(value)
          ? hudsonrock.lookupEmail(value)
          : isDomain(value)
            ? hudsonrock.lookupDomain(value)
            : hudsonrock.lookupUsername(value),
        isEmail(value) ? hibp.lookupBreaches(value, env) : Promise.resolve({
          source: "Have I Been Pwned",
          status: "skipped" as const,
          summary: "HIBP breach lookup is only applicable to email addresses",
        }),
      ]);

      const envelope = await finalizeEnvelope({
        env,
        tool: "account_exposure",
        query: {
          type: isEmail(value) ? "email" : isDomain(value) ? "domain" : "username",
          value,
        },
        sources,
        behavior_tags: ["credential-exposure"],
        analyst_actions: ["Reset credentials if compromise is confirmed", "Review linked hosts and malware families"],
        startTime,
      });

      return envelopeResult(envelope);
    }
  );

  server.tool(
    "password_check",
    "Check a password with HIBP Pwned Passwords using k-anonymity. The full hash is never sent.",
    { password: z.string().describe("Password to check") },
    async ({ password }) => {
      const startTime = Date.now();
      const sources = [await hibp.lookupPassword(password)];
      const envelope = await finalizeEnvelope({
        env,
        tool: "password_check",
        query: { type: "password", value: password },
        sources,
        behavior_tags: ["credential-exposure"],
        analyst_actions: ["Rotate the password if exposed", "Check for password reuse across accounts"],
        startTime,
      });

      return envelopeResult(envelope);
    }
  );

  server.tool(
    "ja3_lookup",
    "Check a JA3 fingerprint against the cached SSLBL feed.",
    { ja3: z.string().describe("JA3 or JA3S fingerprint") },
    async ({ ja3 }) => {
      const startTime = Date.now();
      const sources = [await sslbl.lookupJa3(ja3, env)];
      const envelope = await finalizeEnvelope({
        env,
        tool: "ja3_lookup",
        query: { type: "ja3", value: ja3 },
        sources,
        behavior_tags: ["tls-fingerprint"],
        analyst_actions: ["Pivot into TLS telemetry and destination IPs"],
        startTime,
      });

      return envelopeResult(envelope);
    }
  );

  server.tool(
    "dns_lookup",
    "Resolve DNS records via passive-friendly DoH providers.",
    {
      hostname: z.string().describe("Hostname or domain to resolve"),
      type: z.string().optional().describe("DNS record type, default A"),
    },
    async ({ hostname, type }) => {
      const startTime = Date.now();
      const recordType = (type ?? "A").toUpperCase();
      const sources = await Promise.all([
        doh.lookup(hostname, recordType, "cloudflare"),
        doh.lookup(hostname, recordType, "google"),
      ]);
      const envelope = await finalizeEnvelope({
        env,
        tool: "dns_lookup",
        query: { type: "hostname", value: hostname },
        sources,
        behavior_tags: ["dns-enrichment"],
        analyst_actions: ["Compare current DNS to historical answers", "Check resolver and proxy logs"],
        startTime,
      });

      return envelopeResult(envelope);
    }
  );

  server.tool(
    "cert_lookup",
    "Check certificate transparency and cached SSLBL data for a domain or certificate identifier.",
    { value: z.string().describe("Domain name or certificate identifier") },
    async ({ value }) => {
      const startTime = Date.now();
      const sources = await Promise.all([
        isDomain(value) ? crtsh.lookupDomain(value) : crtsh.lookupCert(value),
        sslbl.lookupCert(value, env),
      ]);
      const envelope = await finalizeEnvelope({
        env,
        tool: "cert_lookup",
        query: { type: "cert", value },
        sources,
        behavior_tags: ["certificate-context"],
        analyst_actions: ["Review hosting and SAN overlap", "Pivot on issuer and related infrastructure"],
        startTime,
      });

      return envelopeResult(envelope);
    }
  );

  server.tool(
    "yara_rule_lookup",
    "Query YARAify for a hash-backed rule hit.",
    { hash: z.string().describe("File hash to query in YARAify") },
    async ({ hash }) => {
      const startTime = Date.now();
      const sources = [await yaraify.lookupHash(hash, env)];
      const envelope = await finalizeEnvelope({
        env,
        tool: "yara_rule_lookup",
        query: { type: "hash", value: hash },
        sources,
        behavior_tags: ["yara-context"],
        analyst_actions: ["Review matching family or rule context", "Pivot on related hashes"],
        startTime,
      });

      return envelopeResult(envelope);
    }
  );

  server.tool(
    "defense_lookup",
    "Search local D3FEND-style defensive technique metadata.",
    { query: z.string().describe("Technique or keyword") },
    async ({ query }) => {
      const startTime = Date.now();
      const corpus = await loadD3fend(env);
      const matches = findAttackMatches(query, corpus);
      const envelope = await finalizeEnvelope({
        env,
        tool: "defense_lookup",
        query: { type: "attack_id", value: query },
        sources: [
          {
            source: "D3FEND",
            status: matches.length ? "cached" : "not_found",
            summary: matches.length ? `${matches.length} defensive match(es)` : "No D3FEND match found",
            data: matches.slice(0, 10),
          },
        ],
        behavior_tags: ["defensive-guidance"],
        analyst_actions: ["Map offensive techniques to available defensive controls"],
        startTime,
      });

      return envelopeResult(envelope);
    }
  );
}
