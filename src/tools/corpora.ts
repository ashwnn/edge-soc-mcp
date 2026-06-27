import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { loadAttackTechniques, loadGtfobins, loadHijackLibs, loadLolbas, loadSigmaRules, loadWadcoms } from "../corpora/loaders.js";
import { findAttackMatches, findHijackMatches, findLolbinMatches, findSigmaMatches, summarizeCommandMatches } from "../corpora/search.js";
import { envelopeResult, finalizeEnvelope, type RuntimeEnv } from "../lib/tool.js";

interface ToolEnv extends RuntimeEnv {
  CORPORA: R2Bucket;
}

export function registerCorporaTools(server: McpServer, env: ToolEnv): void {
  server.tool(
    "lolbin_lookup",
    "Find LOLBAS and GTFOBins context for a binary name, path, or command.",
    { value: z.string().describe("Binary name, path, or command line") },
    async ({ value }) => {
      const startTime = Date.now();
      const [lolbas, gtfobins] = await Promise.all([loadLolbas(env), loadGtfobins(env)]);
      const matches = [...findLolbinMatches(value, lolbas), ...findLolbinMatches(value, gtfobins)];
      const attackIds = matches.flatMap((match) => match.attack_ids);

      const envelope = await finalizeEnvelope({
        env,
        tool: "lolbin_lookup",
        query: { type: "binary", value },
        sources: [
          {
            source: "LOLBAS/GTFOBins",
            status: matches.length ? "cached" : "not_found",
            summary: matches.length ? `${matches.length} corpus match(es)` : "No corpus match found",
            data: matches.slice(0, 10),
          },
        ],
        attack_ids: attackIds,
        behavior_tags: ["living-off-the-land"],
        analyst_actions: ["Check parent process and command-line context"],
        startTime,
      });

      return envelopeResult(envelope);
    }
  );

  server.tool(
    "dll_hijack_lookup",
    "Check HijackLibs for DLL sideloading and hijack opportunities.",
    { dll: z.string().describe("DLL name or vulnerable executable name") },
    async ({ dll }) => {
      const startTime = Date.now();
      const corpus = await loadHijackLibs(env);
      const matches = findHijackMatches(dll, corpus);
      const envelope = await finalizeEnvelope({
        env,
        tool: "dll_hijack_lookup",
        query: { type: "dll", value: dll },
        sources: [
          {
            source: "HijackLibs",
            status: matches.length ? "cached" : "not_found",
            summary: matches.length ? `${matches.length} HijackLibs match(es)` : "No HijackLibs match found",
            data: matches.slice(0, 10),
          },
        ],
        behavior_tags: ["sideloading", "dll-hijack"],
        analyst_actions: ["Review DLL search-order behavior", "Check file path control and signed loader abuse"],
        startTime,
      });

      return envelopeResult(envelope);
    }
  );

  server.tool(
    "command_context",
    "Explain a suspicious command line using local blue-team corpora and ATT&CK context.",
    { command: z.string().describe("Suspicious command line") },
    async ({ command }) => {
      const startTime = Date.now();
      const [lolbas, gtfobins, attacks, wadcoms] = await Promise.all([
        loadLolbas(env),
        loadGtfobins(env),
        loadAttackTechniques(env),
        loadWadcoms(env),
      ]);
      const combined = [...lolbas, ...gtfobins];
      const matches = findLolbinMatches(command, combined);
      const explanation = summarizeCommandMatches(command, combined, attacks, wadcoms);
      const attackIds = matches.flatMap((match) => match.attack_ids);

      const envelope = await finalizeEnvelope({
        env,
        tool: "command_context",
        query: { type: "command", value: command },
        sources: [
          {
            source: "Local corpora",
            status: matches.length ? "cached" : "not_found",
            summary: matches.length ? `${matches.length} command context match(es)` : "No direct corpus match found",
            data: matches.slice(0, 10),
          },
        ],
        attack_ids: attackIds,
        behavior_tags: ["command-analysis"],
        analyst_actions: ["Compare command to process creation telemetry", "Review executing user and host context"],
        command_explanation: explanation,
        startTime,
      });

      return envelopeResult(envelope);
    }
  );

  server.tool(
    "attack_lookup",
    "Search local ATT&CK technique metadata by id or keyword.",
    { query: z.string().describe("ATT&CK technique id, software, group, or keyword") },
    async ({ query }) => {
      const startTime = Date.now();
      const corpus = await loadAttackTechniques(env);
      const matches = findAttackMatches(query, corpus);
      const envelope = await finalizeEnvelope({
        env,
        tool: "attack_lookup",
        query: { type: "attack_id", value: query },
        sources: [
          {
            source: "MITRE ATT&CK",
            status: matches.length ? "cached" : "not_found",
            summary: matches.length ? `${matches.length} ATT&CK match(es)` : "No ATT&CK match found",
            data: matches.slice(0, 10),
          },
        ],
        attack_ids: matches.map((match) => match.id),
        behavior_tags: ["attack-context"],
        analyst_actions: ["Pivot into related detections and data sources"],
        startTime,
      });

      return envelopeResult(envelope);
    }
  );

  server.tool(
    "sigma_lookup",
    "Search local Sigma metadata by ATT&CK id, keyword, product, or logsource.",
    { query: z.string().describe("ATT&CK id, keyword, logsource, or product") },
    async ({ query }) => {
      const startTime = Date.now();
      const corpus = await loadSigmaRules(env);
      const matches = findSigmaMatches(query, corpus);
      const envelope = await finalizeEnvelope({
        env,
        tool: "sigma_lookup",
        query: { type: "attack_id", value: query },
        sources: [
          {
            source: "Sigma",
            status: matches.length ? "cached" : "not_found",
            summary: matches.length ? `${matches.length} Sigma rule match(es)` : "No Sigma rule match found",
            data: matches.slice(0, 15),
          },
        ],
        rule_refs: matches.map((match) => match.id),
        attack_ids: matches.flatMap((match) =>
          (match.tags ?? [])
            .filter((tag) => tag.startsWith("attack."))
            .map((tag) => tag.replace(/^attack\./, "").toUpperCase())
        ),
        behavior_tags: ["detection-context"],
        analyst_actions: ["Review matching detection content in your SIEM or EDR"],
        startTime,
      });

      return envelopeResult(envelope);
    }
  );
}

