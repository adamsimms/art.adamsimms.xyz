# Cloudberry assemble notes

## Local full build (art repo)

```bash
# optional: refresh archive from ../pinchards.is first (CI does this)
# from art.adamsimms.xyz
export PUBLIC_MAPBOX_TOKEN=pk.…       # allowlist art.adamsimms.xyz
export MAPBOX_ACCESS_TOKEN=$PUBLIC_MAPBOX_TOKEN
npm run build:full
```

Output includes `dist/cloudberry/archive/` plus `/maps`, `/maps/trees`, `/maps/resettled`.
Assemble injects Umami and Ghostpane into archive HTML from `analytics.config.json`.

Env overrides: `PINCHARDS_REPO_PATH`, `DORY_REPO_PATH`, `ADRIFT_REPO_PATH`, `WAVES_REPO_PATH`.

## Secrets / vars

### art.adamsimms.xyz

| Name | Type | Purpose |
|------|------|---------|
| `PUBLIC_MAPBOX_TOKEN` | variable (`vars`) | Mapbox `pk.*` for `/maps` + archive photo map |
| `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` | secrets | Wrangler Pages deploy (+ Workers for pinchards redirect; Zone Cache Purge for optional edge purge) |
| `CLOUDFLARE_ZONE_ID` | variable (`vars`) | `adamsimms.xyz` zone id for post-deploy archive cache purge |
| `UMAMI_WEBSITE_ID` | variable (optional if in `analytics.config.json`) | Archive + Astro Umami |
| `GHOSTPANE_SITE_ID` | variable (optional if in `analytics.config.json`) | Archive + Astro Ghostpane |

Add `art.adamsimms.xyz` to the Mapbox token URL restrictions.

### pinchards.is (archive source)

| Name | Type | Purpose |
|------|------|---------|
| `ART_DEPLOY_KEY` | secret | Private half of a write deploy key on `adamsimms/art.adamsimms.xyz`. Archive pushes use it to land a commit here, which starts the Pages workflow. |

## CI

1. Art deploy workflow checks out sibling repos, builds/assembles Cloudberry + siblings into `dist`, deploys Pages, purges selected edge keys.
2. Triggers: push to art `main`, and `workflow_dispatch`.
3. Pinchards workflow `.github/workflows/trigger-art-rebuild.yml` pushes a commit to this repo when archive-affecting paths land on `main`. That push is the rebuild trigger.

**Important:** Only **GitHub Actions / Wrangler** should publish this Pages project. Cloudflare dashboard Git auto-builds must stay **disabled**.

## Parity

See [PHASE3-PARITY.md](./PHASE3-PARITY.md).
