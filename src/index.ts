/**
 * edge-soc-mcp - Cloudflare Workers entry point.
 *
 * Exports:
 *   - EdgeSocMCP (Durable Object): the McpAgent class
 *   - default: the Worker fetch + scheduled handlers (wrapped around OAuthProvider)
 *
 * Auth model: OAuth 2.1 + PKCE via @cloudflare/workers-oauth-provider.
 * The "login" step is a consent page that asks for MCP_AUTH_TOKEN. If it
 * matches, the OAuth authorization code flow completes and the client
 * receives an OAuth access token for subsequent requests to /mcp and /sse.
 */

import { McpAgent } from "agents/mcp";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { OAuthProvider } from "@cloudflare/workers-oauth-provider";
import type { OAuthHelpers, AuthRequest } from "@cloudflare/workers-oauth-provider";
import { registerAllTools } from "./tools/index.js";
import { loadManifest } from "./corpora/loader.js";
import { refreshScheduledFeeds } from "./corpora/refresh.js";

// ---------------------------------------------------------------------------
// Env type - mirrors wrangler.jsonc bindings + secrets.
// The canonical source is the generated worker-configuration.d.ts;
// we declare it here for IDE support before the first `wrangler types` run.
// ---------------------------------------------------------------------------

export interface Env {
  // Bindings
  MCP_OBJECT: DurableObjectNamespace<EdgeSocMCP>;
  CACHE: KVNamespace;
  OAUTH_KV: KVNamespace;
  DB: D1Database;
  CORPORA: R2Bucket;

  // Injected by OAuthProvider at runtime into defaultHandler env
  OAUTH_PROVIDER: OAuthHelpers;

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

export class EdgeSocMCP extends McpAgent<Env, unknown, { user: string }> {
  server = new McpServer({
    name: "edge-soc-mcp",
    version: "0.1.0",
  });

  async init(): Promise<void> {
    registerAllTools(this.server, this.env);
  }
}

// ---------------------------------------------------------------------------
// Consent page HTML helpers
// ---------------------------------------------------------------------------

function renderConsentPage(actionUrl: string, error?: string): string {
  const errorHtml = error
    ? `<p class="error">${escapeHtml(error)}</p>`
    : "";
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>edge-soc-mcp — connect</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 420px; margin: 80px auto; padding: 0 16px; color: #1a1a1a; }
    h1 { font-size: 1.2rem; margin-bottom: 4px; }
    p { color: #555; font-size: 0.9rem; margin-bottom: 20px; }
    label { display: block; font-size: 0.85rem; font-weight: 600; margin-bottom: 6px; }
    input[type=password] { width: 100%; box-sizing: border-box; padding: 8px 10px; border: 1px solid #ccc; border-radius: 6px; font-size: 1rem; }
    button { margin-top: 14px; width: 100%; padding: 10px; background: #f38020; color: #fff; border: none; border-radius: 6px; font-size: 1rem; cursor: pointer; }
    button:hover { background: #d96e10; }
    .error { color: #c0392b; background: #fde8e8; border: 1px solid #f5c6c6; border-radius: 6px; padding: 8px 12px; font-size: 0.85rem; }
  </style>
</head>
<body>
  <h1>edge-soc-mcp</h1>
  <p>Paste your <code>MCP_AUTH_TOKEN</code> to authorize this client.</p>
  ${errorHtml}
  <form method="POST" action="${escapeHtml(actionUrl)}">
    <label for="token">Token</label>
    <input type="password" id="token" name="token" autofocus required>
    <button type="submit">Authorize</button>
  </form>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ---------------------------------------------------------------------------
// Default handler — handles /health, /authorize, and 404s.
// OAuthProvider injects env.OAUTH_PROVIDER (OAuthHelpers) before calling this.
// ---------------------------------------------------------------------------

const defaultHandler: ExportedHandler<Env> = {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // --- GET /health - unauthenticated status endpoint ---
    if (url.pathname === "/health" && request.method === "GET") {
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

    // --- GET /authorize — render the token-paste consent form ---
    if (url.pathname === "/authorize" && request.method === "GET") {
      // Keep all OAuth query params in the form action so POST can re-parse them
      return new Response(renderConsentPage(request.url), {
        headers: { "Content-Type": "text/html; charset=UTF-8" },
      });
    }

    // --- POST /authorize — validate token and complete OAuth flow ---
    if (url.pathname === "/authorize" && request.method === "POST") {
      // MCP_AUTH_TOKEN MUST be set; open OAuth access makes no sense here
      if (!env.MCP_AUTH_TOKEN) {
        return new Response(
          renderConsentPage(
            request.url,
            "MCP_AUTH_TOKEN is not configured on this server. Set it as a Wrangler secret before connecting clients."
          ),
          { status: 500, headers: { "Content-Type": "text/html; charset=UTF-8" } }
        );
      }

      // Read the submitted token from the form body
      let submittedToken = "";
      try {
        const body = await request.formData();
        submittedToken = (body.get("token") as string) ?? "";
      } catch {
        return new Response(
          renderConsentPage(request.url, "Could not parse form submission."),
          { status: 400, headers: { "Content-Type": "text/html; charset=UTF-8" } }
        );
      }

      if (submittedToken !== env.MCP_AUTH_TOKEN) {
        return new Response(
          renderConsentPage(request.url, "Incorrect token. Please try again."),
          { status: 401, headers: { "Content-Type": "text/html; charset=UTF-8" } }
        );
      }

      // Token matches — parse the OAuth params from the URL and complete the flow.
      // The form action preserves the original OAuth query string, so parseAuthRequest
      // reads the OAuth params (client_id, redirect_uri, code_challenge, etc.) from the URL.
      let oauthReq: AuthRequest;
      try {
        oauthReq = await env.OAUTH_PROVIDER.parseAuthRequest(request);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        return new Response(
          renderConsentPage(request.url, `OAuth error: ${msg}`),
          { status: 400, headers: { "Content-Type": "text/html; charset=UTF-8" } }
        );
      }

      const { redirectTo } = await env.OAUTH_PROVIDER.completeAuthorization({
        request: oauthReq,
        userId: "owner",
        scope: oauthReq.scope,
        metadata: {},
        props: { user: "owner" },
      });

      return Response.redirect(redirectTo, 302);
    }

    // --- 404 ---
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  },
};

// ---------------------------------------------------------------------------
// OAuth Provider — wraps /mcp and /sse behind OAuth bearer validation.
// Dynamic client registration (/register) and token endpoint (/token) are
// handled automatically by the library.
// ---------------------------------------------------------------------------

// ExportedHandler with fetch guaranteed (McpAgent.serve always provides it)
type HandlerWithFetch = ExportedHandler<Env> & { fetch: NonNullable<ExportedHandler<Env>["fetch"]> };

const provider = new OAuthProvider<Env>({
  apiHandlers: {
    "/mcp": EdgeSocMCP.serve("/mcp") as HandlerWithFetch,
    "/sse": EdgeSocMCP.serveSSE("/sse") as HandlerWithFetch,
  },
  defaultHandler,
  authorizeEndpoint: "/authorize",
  tokenEndpoint: "/token",
  clientRegistrationEndpoint: "/register",
  scopesSupported: ["mcp"],
});

// ---------------------------------------------------------------------------
// Worker default export
// OAuthProvider only has fetch(); wrap it so we keep the scheduled handler.
// ---------------------------------------------------------------------------

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext) =>
    provider.fetch(request, env, ctx),

  async scheduled(
    _controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    ctx.waitUntil(refreshScheduledFeeds(env));
  },
} satisfies ExportedHandler<Env>;
