# Research admin (phase 3a)

Access-gated triage UI at `https://art.adamsimms.xyz/research/admin`.

## What it does

- List / defer / discard R2 inbox items (enrichment status badges)
- Deep **enrichment** via queue (re-enrich, provenance, graph hints)
- **Promote** → commit `src/content/research/<slug>.md` to `main` + copy attachments to `files/<slug>/` + rebuild R2 indexes
- Edit / delete existing library files via GitHub Contents API
- Refresh `library/index.json` + `site/works.json` + `site/writing.json`

## Deploy

```bash
cd workers/art-adamsimms-xyz-research-admin
npm install
npx wrangler secret put GITHUB_TOKEN   # fine-grained PAT: Contents R/W on adamsimms/art.adamsimms.xyz
npx wrangler deploy
```

Then set Access vars (from Zero Trust → Access → Application → AUD / team domain):

```bash
npx wrangler secret put POLICY_AUD
# or wrangler.toml [vars]:
# TEAM_DOMAIN = "https://YOURTEAM.cloudflareaccess.com"
# POLICY_AUD = "..."
```

`TEAM_DOMAIN` can be a plain `[vars]` string; `POLICY_AUD` and `GITHUB_TOKEN` should be secrets.

## Cloudflare Access

1. Zero Trust → Access → Applications → Add **Self-hosted**
2. Application domain: `art.adamsimms.xyz`
3. Path: `/research/admin` (and `/research/admin/*` if prompted)
4. Policy: allow your email(s) only
5. Copy **Application Audience (AUD)** into Worker `POLICY_AUD`
6. Team domain → `TEAM_DOMAIN` as `https://<team>.cloudflareaccess.com`

## Local

```bash
# wrangler.toml or .dev.vars
ALLOW_INSECURE_DEV=true
GITHUB_TOKEN=ghp_...
npx wrangler dev
```

Open the printed URL with path `/research/admin/`.

## Routes

Worker routes (in `wrangler.toml`) bind `art.adamsimms.xyz/research/admin*`. If deploy fails on zone, confirm `art` lives on the `adamsimms.xyz` zone and adjust `zone_name` if needed.
