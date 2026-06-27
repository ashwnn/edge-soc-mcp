/**
 * Tool registration entry point.
 *
 * In P0 we register only the `health` smoke tool.
 * Later phases add: ip_lookup, domain_lookup, url_lookup, hash_lookup,
 * cve_lookup, lolbin_lookup, dll_hijack_lookup, command_context,
 * attack_lookup, sigma_lookup, account_exposure, ja3_lookup.
 */

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadManifest } from "../corpora/loader.js";
import { registerObservableTools } from "./observables.js";
import { registerCorporaTools } from "./corpora.js";
import { registerExtraTools } from "./extras.js";

// Env subset needed by tools registered here
interface ToolEnv {
  CACHE: KVNamespace;
  DB?: D1Database;
  CORPORA: R2Bucket;
  ABUSE_CH_AUTH_KEY?: string;
  ABUSEIPDB_API_KEY?: string;
  GREYNOISE_API_KEY?: string;
  IPINFO_TOKEN?: string;
  URLSCAN_API_KEY?: string;
  PULSEDIVE_API_KEY?: string;
  OTX_API_KEY?: string;
  NVD_API_KEY?: string;
  HUDSONROCK_API_KEY?: string;
  HIBP_API_KEY?: string;
  SPUR_TOKEN?: string;
  VT_API_KEY?: string;
}

/**
 * Register all tools on the given MCP server.
 * Called from EdgeSocMCP.init().
 */
export function registerAllTools(server: McpServer, env: ToolEnv): void {
  registerHealth(server, env);
  registerObservableTools(server, env);
  registerCorporaTools(server, env);
  registerExtraTools(server, env);
}

// ---------------------------------------------------------------------------
// Health / smoke tool
// ---------------------------------------------------------------------------

function registerHealth(server: McpServer, env: ToolEnv): void {
  server.tool(
    "health",
    "Return server status and a summary of available corpora. Use this to verify the MCP server is running and corpora are loaded.",
    {},
    async () => {
      const manifest = await loadManifest(env);

      const corpusSummary = manifest
        ? manifest.entries.map((e) => ({
            name: e.name,
            count: e.count,
            fetched_at: e.fetched_at,
            version: e.version ?? null,
          }))
        : null;

      const result = {
        status: "ok",
        server: "edge-soc-mcp",
        corpora: corpusSummary
          ? { loaded: true, entries: corpusSummary }
          : { loaded: false, note: "Manifest not found — run seed-corpora.ts" },
        generated_at: new Date().toISOString(),
      };

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(result, null, 2),
          },
        ],
        structuredContent: result,
      };
    }
  );
}
