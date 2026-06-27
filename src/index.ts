/**
 * edge-soc-mcp — Cloudflare Workers entry point.
 *
 * Exports:
 *   - EdgeSocMCP (Durable Object): the McpAgent class
 *   - default: the Worker fetch + scheduled handlers
 */

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerAllTools } from "./tools/index.js";
import { loadManifest } from "./corpora/loader.js";
import { refreshScheduledFeeds } from "./corpora/refresh.js";

// ---------------------------------------------------------------------------
// Env type — mirrors wrangler.jsonc bindings + secrets.
// The canonical source is the generated worker-configuration.d.ts;
// we declare it here for IDE support before the first `wrangler types` run.
// ---------------------------------------------------------------------------

export interface Env {
  // Bindings
  MCP_OBJECT: DurableObjectNamespace;
  CACHE: KVNamespace;
  DB: D1Database;
  CORPORA: R2Bucket;

  // Secrets (all optional)
  MCP_AUTH_TOKEN?: string;
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

// ---------------------------------------------------------------------------
// McpAgent Durable Object
// ---------------------------------------------------------------------------

export class EdgeSocMCP extends McpAgent<Env> {
  server = new McpServer({
    name: "edge-soc-mcp",
    version: "0.1.0",
  });

  async init(): Promise<void> {
    registerAllTools(this.server, this.env);
  }
}

// ---------------------------------------------------------------------------
// Auth guard helper
// ---------------------------------------------------------------------------

function unauthorizedResponse(): Response {
  return new Response(
    JSON.stringify({ error: "Unauthorized", message: "Missing or invalid Bearer token" }),
    {
      status: 401,
      headers: {
        "Content-Type": "application/json",
        "WWW-Authenticate": 'Bearer realm="edge-soc-mcp"',
      },
    }
  );
}

function checkAuth(request: Request, env: Env): boolean {
  if (!env.MCP_AUTH_TOKEN) {
    // No token configured — open access (personal use)
    return true;
  }
  const authHeader = request.headers.get("Authorization") ?? "";
  return authHeader === `Bearer ${env.MCP_AUTH_TOKEN}`;
}

// ---------------------------------------------------------------------------
// Worker default export
// ---------------------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // --- /health — unauthenticated status endpoint ---
    if (url.pathname === "/health") {
      const manifest = await loadManifest(env);
      const body = {
        status: "ok",
        server: "edge-soc-mcp",
        corpora: manifest
          ? { loaded: true, count: manifest.entries.length }
          : { loaded: false },
        generated_at: new Date().toISOString(),
      };
      return new Response(JSON.stringify(body, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // --- /mcp — Streamable HTTP transport (auth-gated) ---
    if (url.pathname === "/mcp") {
      if (!checkAuth(request, env)) {
        return unauthorizedResponse();
      }
      return EdgeSocMCP.serve("/mcp").fetch(request, env, ctx);
    }

    // --- /sse — SSE transport for legacy clients (auth-gated) ---
    if (url.pathname === "/sse" || url.pathname.startsWith("/sse/")) {
      if (!checkAuth(request, env)) {
        return unauthorizedResponse();
      }
      return EdgeSocMCP.serveSSE("/sse").fetch(request, env, ctx);
    }

    // --- 404 ---
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  },

  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(refreshScheduledFeeds(env));
  },
} satisfies ExportedHandler<Env>;
