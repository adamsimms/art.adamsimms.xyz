# Phase 3 — static assemble notes

## Local full build (art repo)

```bash
# from pinchards.is
php scripts/build-catalog.php          # if catalog stale
php scripts/build-static-archive.php

# from art.adamsimms.xyz
export PUBLIC_MAPBOX_TOKEN=pk.…       # allowlist art.adamsimms.xyz
export MAPBOX_ACCESS_TOKEN=$PUBLIC_MAPBOX_TOKEN
npm run build:full
```

Output: `dist/cloudberry/archive/` + `/maps`, `/maps/trees`, `/maps/resettled`.
Assemble injects art Umami into archive HTML from `analytics.config.json` / `UMAMI_WEBSITE_ID`.

## Secrets / vars

### art.adamsimms.xyz

| Name | Type | Purpose |
|------|------|---------|
| `PUBLIC_MAPBOX_TOKEN` | variable (`vars`) | Mapbox `pk.*` for `/maps` + archive photo map |
| `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` | secrets | Wrangler Pages deploy + cache purge |
| `UMAMI_WEBSITE_ID` | variable (optional if in `analytics.config.json`) | Archive + Astro analytics |

Add `art.adamsimms.xyz` to the Mapbox token URL restrictions.

### pinchards.is

| Name | Type | Purpose |
|------|------|---------|
| `ART_DISPATCH_TOKEN` | secret | Fine-grained PAT with **Actions: write** on `adamsimms/art.adamsimms.xyz` so archive changes can `repository_dispatch` a Pages rebuild |

## CI

1. Art deploy workflow checks out `adamsimms/pinchards.is`, builds the static archive with PHP, assembles into `dist` (Umami inject), deploys Pages, purges poisoned archive edge keys.
2. Triggers: push to art `main`, `workflow_dispatch`, and `repository_dispatch` type `cloudberry-archive-rebuild`.
3. Pinchards workflow `.github/workflows/trigger-art-rebuild.yml` emits that dispatch when archive-affecting paths land on `main`.

**Important:** Only **GitHub Actions / Wrangler** should publish this Pages project. Cloudflare dashboard Git auto-builds must stay **disabled** (a bare `npm run build` overwrites `/cloudberry/archive` and soft-404s assets to the homepage).

## Parity

See [PHASE3-PARITY.md](./PHASE3-PARITY.md).
