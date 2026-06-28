# Setup Guide

This guide walks through deploying edge-soc-mcp from scratch. No prior Cloudflare or Wrangler experience is assumed.

---

## What you need before starting

- A computer running Windows, macOS, or Linux
- [Git](https://git-scm.com/downloads) installed
- A terminal (Command Prompt, PowerShell, or Terminal.app)
- About 20 minutes

---

## Step 1 - Create a free Cloudflare account

Go to [https://dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) and register. The free plan covers everything this project uses: Workers, KV, D1, R2, Durable Objects, and cron triggers. No credit card is required to sign up, but you will need to add a payment method in Step 6 before R2 storage will work (Cloudflare uses it to prevent abuse, not to charge you at free-tier usage levels).

---

## Step 2 - Install Bun

Bun is a fast JavaScript runtime that also acts as the package manager for this project.

**Windows (PowerShell):**
```powershell
powershell -c "irm bun.sh/install.ps1 | iex"
```

**macOS / Linux:**
```bash
curl -fsSL https://bun.sh/install | bash
```

After the installer finishes, close and reopen your terminal, then confirm it works:

```bash
bun --version
```

You should see a version number like `1.x.x`. Full installation docs are at [https://bun.sh/docs/installation](https://bun.sh/docs/installation).

---

## Step 3 - Clone the repository

Run the following in your terminal. This downloads the project to a folder called `edge-soc-mcp` in your current directory.

```bash
git clone https://github.com/ashwnn/edge-soc-mcp.git
cd edge-soc-mcp
```

---

## Step 4 - Install dependencies

Inside the project folder, run:

```bash
bun install
```

This downloads all the required packages. It should finish in a few seconds.

---

## Step 5 - Log in to Cloudflare

This command opens a browser window where you authorize Wrangler (the Cloudflare CLI tool bundled with this project) to act on your account:

```bash
bun x wrangler login
```

A browser tab will open at the Cloudflare authorization page. Click **Allow**. Once you see "You have granted authorization to Wrangler", return to your terminal. Wrangler docs for this step: [https://developers.cloudflare.com/workers/wrangler/commands/#login](https://developers.cloudflare.com/workers/wrangler/commands/#login).

---

## Step 6 - Enable R2 in the Cloudflare dashboard

Before creating any resources, you need to enable the R2 storage service on your account. R2 is free up to 10 GB/month, but Cloudflare requires a payment method on file before activating it.

1. Go to [https://dash.cloudflare.com](https://dash.cloudflare.com) and log in.
2. Click **R2 Object Storage** in the left sidebar.
3. Follow the prompt to add a payment method.
4. Once R2 shows as active, return to your terminal.

R2 documentation: [https://developers.cloudflare.com/r2/get-started/](https://developers.cloudflare.com/r2/get-started/)

---

## Step 7 - Create the four backing resources

Run each command below one at a time. After each one, the terminal will print some details including an **ID** or **database_id** - you will need to copy these in the next step.

**KV namespace** (short-TTL verdict cache and feed catalogs):
```bash
bun x wrangler kv namespace create CACHE
```

The output will look like this. Copy the `id` value:
```
Add the following to your configuration file in your kv_namespaces array:
{ binding = "CACHE", id = "a1b2c3d4e5f6..." }
```

**KV namespace** (OAuth token and grant storage):
```bash
bun x wrangler kv namespace create OAUTH_KV
```

The output has the same shape. Copy the `id` value:
```
{ binding = "OAUTH_KV", id = "b2c3d4e5f6a1..." }
```

**D1 database** (a SQLite database):
```bash
bun x wrangler d1 create edge-soc-mcp-db
```

The output will look like this. Copy the `database_id` value:
```
Successfully created DB 'edge-soc-mcp-db'

[[d1_databases]]
binding = "DB"
database_name = "edge-soc-mcp-db"
database_id = "a1b2c3d4-e5f6-..."
```

**R2 bucket** (object storage for corpus files):
```bash
bun x wrangler r2 bucket create edge-soc-mcp-corpora
```

This one does not return an ID; just confirm it says "Created bucket 'edge-soc-mcp-corpora'".

KV docs: [https://developers.cloudflare.com/kv/get-started/](https://developers.cloudflare.com/kv/get-started/)  
D1 docs: [https://developers.cloudflare.com/d1/get-started/](https://developers.cloudflare.com/d1/get-started/)

---

## Step 8 - Paste the IDs into wrangler.jsonc

The repo ships a `wrangler.jsonc.example` template. Copy it to `wrangler.jsonc` first — the real `wrangler.jsonc` is gitignored, so your resource IDs stay out of version control:

```bash
cp wrangler.jsonc.example wrangler.jsonc
```

Open the new `wrangler.jsonc` in the project folder with any text editor (Notepad, VS Code, TextEdit, etc.).

Find the `kv_namespaces` section and replace the placeholder IDs with the ones you copied:

**Before:**
```jsonc
"kv_namespaces": [
  {
    "binding": "CACHE",
    "id": "REPLACE_WITH_CACHE_KV_ID",
    "remote": true
  },
  {
    "binding": "OAUTH_KV",
    "id": "REPLACE_WITH_OAUTH_KV_ID",
    "remote": true
  }
],
```

**After (your actual IDs will differ):**
```jsonc
"kv_namespaces": [
  {
    "binding": "CACHE",
    "id": "a1b2c3d4e5f6abc123456789abcdef01",
    "remote": true
  },
  {
    "binding": "OAUTH_KV",
    "id": "b2c3d4e5f6a1abc123456789abcdef02",
    "remote": true
  }
],
```

Next, find the `d1_databases` section and replace the `"database_id"` placeholder:

**Before:**
```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_id": "REPLACE_WITH_D1_DATABASE_ID",
    "database_name": "edge-soc-mcp-db"
  }
],
```

**After:**
```jsonc
"d1_databases": [
  {
    "binding": "DB",
    "database_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "database_name": "edge-soc-mcp-db"
  }
],
```

Save the file.

---

## Step 9 - Generate TypeScript types

This step generates `worker-configuration.d.ts`, which gives TypeScript accurate types for your Cloudflare bindings. It is required before running `bun run typecheck`, and should be re-run any time you change `wrangler.jsonc`:

```bash
bun x wrangler types
```

---

## Step 10 - Set secrets

### Required secret

`MCP_AUTH_TOKEN` is the password you will paste on the OAuth consent screen when connecting a client. Choose any secure string (a long random value is recommended). The server refuses all authorization attempts if this secret is not set.

```bash
bun x wrangler secret put MCP_AUTH_TOKEN
```

### Optional API secrets

The server deploys and runs without any API keys. Sources that require a key simply report `auth_missing` and are skipped. Adding keys unlocks more data for each tool.

For each key you want to add, run the command below and paste the key when prompted. Nothing is echoed to the screen while you type.

```bash
bun x wrangler secret put ABUSEIPDB_API_KEY
```

Available optional secrets and where to get each key:

| Secret name | Where to register |
|---|---|
| `ABUSEIPDB_API_KEY` | [https://www.abuseipdb.com/register](https://www.abuseipdb.com/register) |
| `ABUSE_CH_AUTH_KEY` | [https://auth.abuse.ch/](https://auth.abuse.ch/) (covers URLhaus, ThreatFox, MalwareBazaar, YARAify) |
| `GREYNOISE_API_KEY` | [https://www.greynoise.io/](https://www.greynoise.io/) |
| `IPINFO_TOKEN` | [https://ipinfo.io/signup](https://ipinfo.io/signup) |
| `URLSCAN_API_KEY` | [https://urlscan.io/user/signup](https://urlscan.io/user/signup) |
| `OTX_API_KEY` | [https://otx.alienvault.com/](https://otx.alienvault.com/) |
| `NVD_API_KEY` | [https://nvd.nist.gov/developers/request-an-api-key](https://nvd.nist.gov/developers/request-an-api-key) |
| `PULSEDIVE_API_KEY` | [https://pulsedive.com/](https://pulsedive.com/) |
| `HUDSONROCK_API_KEY` | [https://www.hudsonrock.com/](https://www.hudsonrock.com/) |
| `HIBP_API_KEY` | [https://haveibeenpwned.com/API/Key](https://haveibeenpwned.com/API/Key) (paid) |
| `VT_API_KEY` | [https://www.virustotal.com/](https://www.virustotal.com/) (non-commercial) |
| `SPUR_TOKEN` | [https://spur.us/](https://spur.us/) (paid) |

Secrets documentation: [https://developers.cloudflare.com/workers/configuration/secrets/](https://developers.cloudflare.com/workers/configuration/secrets/)

---

## Step 11 - Seed corpus data into R2

Several tools rely on pre-loaded data files in R2: ATT&CK techniques, Sigma rules, LOLBAS, GTFOBins, HijackLibs, WADComs, and D3FEND. This command downloads and uploads all of them:

```bash
bun run seed
```

The script will print progress as it downloads and uploads each corpus. This may take a few minutes on a slow connection because some upstream files (particularly ATT&CK STIX and the Sigma rule set) are large. You only need to run this once after initial setup; the cron job handles time-sensitive feed updates automatically.

---

## Step 12 - Deploy

```bash
bun x wrangler deploy
```

Wrangler will bundle the worker, run the Durable Object migration, and upload everything to Cloudflare. When it finishes, it prints a URL like:

```
Published edge-soc-mcp (x.xx sec)
  https://edge-soc-mcp.<your-subdomain>.workers.dev
```

Copy that URL. You will use it to connect your MCP client.

Workers deployment docs: [https://developers.cloudflare.com/workers/get-started/guide/](https://developers.cloudflare.com/workers/get-started/guide/)

---

## Step 13 - Verify it is running

Open your browser and go to:

```
https://edge-soc-mcp.<your-subdomain>.workers.dev/health
```

You should see a JSON response that looks like this:

```json
{
  "status": "ok",
  "server": "edge-soc-mcp",
  "corpora": { "loaded": true, "count": 3000 },
  "generated_at": "2026-..."
}
```

If `corpora.loaded` is `false`, the seed script from Step 11 did not complete successfully. Re-run `bun run seed` and then redeploy.

---

## Step 14 - Connect an MCP client

The server uses OAuth 2.1 + PKCE. ChatGPT (Actions) and Claude (custom connectors) handle the OAuth flow automatically.

### ChatGPT or Claude custom connector

1. In your client's connector or plugin settings, enter the worker URL as the server URL:
   ```
   https://edge-soc-mcp.<your-subdomain>.workers.dev
   ```
2. The client will redirect you to `/authorize`, which shows a password prompt titled **"edge-soc-mcp — connect"**.
3. Paste the value of your `MCP_AUTH_TOKEN` secret and click **Authorize**.
4. The client receives an OAuth access token and connects. You will not need to paste the token again for this client unless the token is revoked.

Dynamic client registration is supported at `/register`, so no manual OAuth client setup is required.

### MCP CLI or other clients

For clients that support streamable HTTP and can initiate an OAuth flow, use the base URL:
```
https://edge-soc-mcp.<your-subdomain>.workers.dev
```

For legacy SSE clients that accept a token directly, complete the OAuth flow once (e.g. via a browser at `/authorize`) to obtain an access token, then configure the client:

```json
{
  "type": "sse",
  "url": "https://edge-soc-mcp.<your-subdomain>.workers.dev/sse",
  "headers": {
    "Authorization": "Bearer <oauth-access-token>"
  }
}
```

---

## Updating corpora data in the future

The cron job handles feed refreshes (CISA KEV, OpenPhish, SSLBL) every 6 hours automatically. For the larger corpus files, run the seed script again and redeploy:

```bash
bun run seed
bun x wrangler deploy
```

---

## Troubleshooting

**"Error: KV namespace not found"** - Double-check that the ID in `wrangler.jsonc` matches exactly what was printed in Step 7. There are no spaces or extra characters in the ID.

**"Error: D1 database not found"** - Same as above; verify the `database_id` in `wrangler.jsonc`. D1 IDs are UUID-formatted (hyphenated).

**"R2 bucket does not exist"** - Confirm that R2 is active on your account (Step 6) and that the bucket `edge-soc-mcp-corpora` was created successfully in Step 7.

**The `/health` endpoint returns `corpora: { loaded: false }`** - The R2 seed did not complete. Run `bun run seed` again, watch for any error messages, and redeploy afterward.

**Worker returns 401 Unauthorized** - The OAuth access token is missing or expired. Re-initiate the OAuth flow from your client to obtain a fresh token. If you see "MCP_AUTH_TOKEN is not configured", set the secret with `bun x wrangler secret put MCP_AUTH_TOKEN` and redeploy.

Wrangler error reference: [https://developers.cloudflare.com/workers/observability/errors/](https://developers.cloudflare.com/workers/observability/errors/)
