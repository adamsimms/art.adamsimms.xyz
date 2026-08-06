# Deployment — art.adamsimms.xyz

## Cloudflare resources

| Resource | Name / value |
| --- | --- |
| GitHub repo | `adamsimms/art.adamsimms.xyz` |
| Pages project | `art-adamsimms-xyz` |
| Custom domain | `art.adamsimms.xyz` |
| R2 bucket (portfolio) | `art-adamsimms-xyz` → `media.adamsimms.xyz` |
| R2 buckets (Cloudberry) | `art-adamsimms-xyz-cloudberry-images` / `-thumbs` → `cloudberry-*.adamsimms.xyz` |
| R2 bucket (research inbox) | `art-adamsimms-xyz-research` (private; email capture) |
| Redirect Worker | `pinchards-redirect` → routes on `pinchards.is` / `www` |
| Redirect Worker | `adamsim-ms-redirect` → routes on `adamsim.ms` / `www` |
| Email Worker | `art-adamsimms-xyz-research` → `research@adamsimms.xyz` (Email Routing on `adamsimms.xyz`) |
| Research admin Worker | `art-adamsimms-xyz-research-admin` → `art.adamsimms.xyz/research/admin*` (Cloudflare Access) |

## How production deploys

**GitHub Actions only** (`Deploy to Cloudflare Pages` → `wrangler pages deploy`).

Do **not** enable Cloudflare Pages “Git integration” auto-builds. A dashboard build runs bare `npm run build` without assembling `/cloudberry/archive` and will overwrite a good deploy.

Optional: `repository_dispatch` type `cloudberry-archive-rebuild` from `pinchards.is` (requires `ART_DISPATCH_TOKEN` there).

## Initial setup

1. Create the Pages project; keep publishing via Wrangler/GHA. If Git is connected in the Cloudflare dashboard, **disable automatic production deployments**.
2. Create R2 bucket `art-adamsimms-xyz` and enable public access at `media.adamsimms.xyz`.
3. Add DNS CNAME records:
   - `art` → Pages project
   - `media` → R2 public bucket domain
   - `cloudberry-images` / `cloudberry-thumbs` → Cloudberry R2 buckets
4. Set GitHub Actions secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
5. Set GitHub variables: `UMAMI_WEBSITE_ID` (same as `adamsimms.xyz`), `PUBLIC_MAPBOX_TOKEN`, optional `CLOUDFLARE_ZONE_ID`.

## Media upload

After running `npm run migrate:images`:

```bash
npx wrangler login
npm run upload:media
```

Images are stored as AVIF (primary) + JPEG (fallback) at:

- `work/<slug>/NN.avif`
- `work/<slug>/NN.jpg`

Uploads set `Cache-Control: public, max-age=31536000, immutable`. To restamp existing objects:

```bash
node scripts/restamp-r2-cache.mjs work/
```

Hover covers + home hero poster variants (AVIF + 960w):

```bash
node scripts/perf-media.mjs
```

## robots.txt + Cloudflare AI crawlers

`public/robots.txt` lists AI crawler `Disallow` rules in-repo. In the Cloudflare dashboard for `adamsimms.xyz`, turn **off** managed robots.txt / “Display Content Signals Policy” for this hostname so Cloudflare does not inject a `Content-Signal` line (Lighthouse SEO flags that directive as unknown). Keep the in-repo Disallows for GPTBot, Google-Extended, etc.

## Assembled apps

`npm run build:full` (and CI) assembles into `dist/`:

| Path | Source |
|------|--------|
| `/cloudberry/archive/` | `adamsimms/pinchards.is` static archive |
| `/dory/` | `adamsimms/dory` |
| `/adrift/experience/` | `adamsimms/adrift` (+ `/adrift/api/weather` Function) |
| `/waves/` | `adamsimms/waves` (+ `/waves/call-api`, `/waves/health` Functions) |
| `/dreamberry/` | `adamsimms/dreamberry` `window/` (portfolio + `/window` + `/info`) |

See [docs/CLOUDBERRY-ASSEMBLE.md](docs/CLOUDBERRY-ASSEMBLE.md), [docs/PHASE4-SIBLINGS.md](docs/PHASE4-SIBLINGS.md).

## Redirects

**In-repo** (`public/_redirects`): portfolio aliases, trailing-slash mounts, legacy archive path aliases.

**pinchards.is**: Worker `pinchards-redirect` (see [docs/PHASE5-CUTOVER.md](docs/PHASE5-CUTOVER.md)). Keep `pinchards.is` / `www` DNS proxied.

**adamsim.ms**: Worker `adamsim-ms-redirect` — 301s apex/`www` to `art.adamsimms.xyz` (path aliases match `public/_redirects`). Keep `adamsim.ms` / `www` DNS **proxied**; Squarespace origin records can stay until you cancel the subscription.

## Research email inbox + enrichment

Private capture into R2 (`art-adamsimms-xyz-research`) via Email Routing on **`adamsimms.xyz`**:

- Address: `research@adamsimms.xyz`
- Worker: `art-adamsimms-xyz-research` — deploy from `workers/art-adamsimms-xyz-research/` (`npx wrangler deploy`)
- Queue: `art-adamsimms-xyz-research-enrich` (deep enrich consumer on the same Worker)
- Allowlist: `adamsimms@gmail.com`, `hello@adamsimms.xyz`

Full setup, enrich stages, and object layout: [docs/RESEARCH-INBOX.md](docs/RESEARCH-INBOX.md).

## Research admin (phase 3a)

Triage + promote UI at **`https://art.adamsimms.xyz/research/admin`** (Worker route; Cloudflare Access).

```bash
cd workers/art-adamsimms-xyz-research-admin
npx wrangler secret put GITHUB_TOKEN    # Contents R/W on this repo
npx wrangler deploy
```

Set `TEAM_DOMAIN` + `POLICY_AUD` from the Access application. Details: [workers/art-adamsimms-xyz-research-admin/README.md](workers/art-adamsimms-xyz-research-admin/README.md).
