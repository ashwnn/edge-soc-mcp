# edge-soc-mcp

A Cloudflare Workers [MCP](https://modelcontextprotocol.io) server that puts a SOC analyst's enrichment, investigation, and detection-context workflow behind a single endpoint — and runs on a free Cloudflare account.

![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![MCP](https://img.shields.io/badge/Model_Context_Protocol-1.x-black)
![Free tier](https://img.shields.io/badge/runs_on-free_tier-brightgreen)

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/ashwnn/edge-soc-mcp)

## Why it's built this way

- **One tool per task, not one tool per vendor.** `ip_lookup` fans out across AbuseIPDB, GreyNoise, Shodan, IPinfo, and more, then returns a single verdict — not five raw API payloads for you to reconcile.
- **Free by default.** Runs entirely on Cloudflare's free tier (Workers, Durable Objects, KV, D1, R2, cron). Every paid or keyed source is optional.
- **Degrades cleanly.** A missing API key just marks that source `auth_missing`; the tool still answers with whatever is available.
- **Verdict separated from evidence.** Every tool returns the same normalized envelope, so an agent gets a clear answer *and* the operational notes behind it.

Under the hood it aggregates **20+ threat-intel and detection sources** plus bundled corpora (ATT&CK, Sigma, LOLBAS, GTFOBins, HijackLibs, WADComs, D3FEND) into **18 MCP tools**.

## Tools

**Observables**

| Tool | What it does |
|------|--------------|
| `health` | Service status and per-source availability |
| `ip_lookup` | IP reputation, geo/ASN, and exposure |
| `domain_lookup` | Domain reputation and registration context |
| `url_lookup` | URL reputation and phishing checks |
| `hash_lookup` | File-hash reputation and malware context |
| `cve_lookup` | CVE severity with EPSS score and KEV status |

**Corpora-backed**

| Tool | What it does |
|------|--------------|
| `lolbin_lookup` | Living-off-the-land binaries (LOLBAS / GTFOBins) |
| `dll_hijack_lookup` | DLL hijacking references (HijackLibs) |
| `command_context` | Explain a suspicious command line or binary |
| `attack_lookup` | MITRE ATT&CK technique lookup |
| `sigma_lookup` | Matching Sigma detection rules |

**Identity & extras**

| Tool | What it does |
|------|--------------|
| `account_exposure` | Infostealer / account exposure (Hudson Rock) |
| `password_check` | Pwned-password check via HIBP k-anonymity |
| `ja3_lookup` | JA3 TLS fingerprint reputation (SSLBL) |
| `dns_lookup` | DNS resolution over DoH |
| `cert_lookup` | Certificate context (crt.sh / SSLBL) |
| `yara_rule_lookup` | YARA rule lookup (YARAify) |
| `defense_lookup` | D3FEND-style defensive countermeasures |

## What a tool returns

Each tool emits the same normalized envelope, keeping the verdict separate from the evidence behind it:

| Field | Purpose |
|-------|---------|
| `query` | The observable that was looked up |
| `verdict` | The summarized answer |
| `behavior_tags` | Notable behaviors observed |
| `attack_ids` | Related MITRE ATT&CK techniques |
| `rule_refs` | Related detection rules (e.g. Sigma) |
| `command_explanation` | Plain-language breakdown, when relevant |
| `analyst_actions` | Suggested next steps |
| `source_restrictions` | Usage limits on the data used |
| `sources` | Raw evidence per source |
| `meta` | Timing, cache, and diagnostic info |

## Quickstart

```bash
# 1. Install
bun install

# 2. Log in and create backing resources
bun x wrangler login
bun x wrangler kv namespace create CACHE
bun x wrangler d1 create edge_soc
bun x wrangler r2 bucket create edge-soc-corpora

# 3. Paste the returned IDs into wrangler.jsonc, then generate types
bun x wrangler types

# 4. Seed corpora into R2 and deploy
bun run seed
bun x wrangler deploy
```

> R2 must be enabled in the Cloudflare dashboard before uploads will work.

### Optional secrets

The server runs without any keys — each one just unlocks more sources. Set the ones you want:

```bash
bun x wrangler secret put MCP_AUTH_TOKEN      # bearer guard for /mcp and /sse
bun x wrangler secret put ABUSEIPDB_API_KEY
bun x wrangler secret put ABUSE_CH_AUTH_KEY   # URLhaus, ThreatFox, MalwareBazaar, YARAify
bun x wrangler secret put GREYNOISE_API_KEY
bun x wrangler secret put IPINFO_TOKEN
bun x wrangler secret put URLSCAN_API_KEY
bun x wrangler secret put PULSEDIVE_API_KEY
bun x wrangler secret put OTX_API_KEY
bun x wrangler secret put NVD_API_KEY
bun x wrangler secret put HUDSONROCK_API_KEY
bun x wrangler secret put HIBP_API_KEY
bun x wrangler secret put SPUR_TOKEN
bun x wrangler secret put VT_API_KEY
```

## Connecting an MCP client

Point your client at the deployed `/mcp` URL as a streamable HTTP endpoint:

```json
{
  "type": "streamable-http",
  "url": "https://your-worker.your-subdomain.workers.dev/mcp",
  "headers": { "Authorization": "Bearer your-token" }
}
```

Legacy SSE clients can use `/sse`. If `MCP_AUTH_TOKEN` is set, both endpoints require `Authorization: Bearer <token>`.

## Local development

```bash
bun install
bun x wrangler types
bun test
bun run typecheck
bun x wrangler dev
```

The worker exposes `GET /health`, `POST /mcp`, and `GET /sse`.

Full verification before deploy:

```bash
bun run typecheck && bun test && bun x wrangler deploy --dry-run --outdir dist
```

## Sources & restrictions

<details>
<summary>Free and strongly recommended</summary>

- AbuseIPDB: [register](https://www.abuseipdb.com/register)
- abuse.ch auth bundle for URLhaus, ThreatFox, MalwareBazaar, YARAify: [register](https://auth.abuse.ch/)
- GreyNoise Community: [signup](https://www.greynoise.io/)
- IPinfo Lite: [signup](https://ipinfo.io/signup)
- urlscan.io: [signup](https://urlscan.io/user/signup)
- NVD API key: [request](https://nvd.nist.gov/developers/request-an-api-key)
- OTX: [signup](https://otx.alienvault.com/)
- Pulsedive: [signup](https://pulsedive.com/)

</details>

<details>
<summary>Keyless sources, already supported</summary>

- Shodan InternetDB
- OpenPhish feed
- PhishTank best-effort URL check
- crt.sh
- RDAP via `rdap.org`
- EPSS
- CISA KEV
- Hudson Rock Cavalier OSINT
- HIBP Pwned Passwords
- Cloudflare DoH
- Google DoH
- SSLBL cached feeds

</details>

<details>
<summary>Paid or cautionary sources</summary>

- Have I Been Pwned breach API: [key purchase](https://haveibeenpwned.com/API/Key)
- Spur Context: [pricing](https://spur.us/)
- VirusTotal Public API: [signup](https://www.virustotal.com/) — non-commercial and rate-limited
- Shodan InternetDB — non-commercial

</details>

> Most lookups are passive and low-volume, but public and community APIs still carry rate limits, and some free sources are non-commercial only.

## Scheduled refresh

A cron-triggered job keeps fast-moving feeds current:

- CISA KEV → KV
- OpenPhish → R2
- SSLBL IP, JA3, and certificate feeds → R2

Larger corpora are loaded with `bun run seed`. Re-run it to refresh ATT&CK, Sigma, LOLBAS, GTFOBins, HijackLibs, WADComs, or D3FEND data.

## Implementation notes

- `McpAgent` is bound to a SQLite Durable Object via `new_sqlite_classes`, the state path that stays free-plan compatible.
- The Cloudflare free tier currently supports Durable Objects, KV, D1, R2, and cron — everything this server needs.

## Non-goals

- No detonation or sandbox execution
- No public submission workflows for urlscan, VirusTotal, or YARAify
- No Sigma query-language translation
- No Threat Jammer integration
