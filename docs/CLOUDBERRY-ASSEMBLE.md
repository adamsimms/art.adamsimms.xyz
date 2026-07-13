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

## Secrets / vars to set on art.adamsimms.xyz GitHub

| Name | Type | Purpose |
|------|------|---------|
| `PUBLIC_MAPBOX_TOKEN` | variable (`vars`) | Mapbox `pk.*` for `/maps` + archive photo map |
| Existing | `CLOUDFLARE_*`, `UMAMI_WEBSITE_ID` | unchanged |

Add `art.adamsimms.xyz` to the Mapbox token URL restrictions.

## CI

Art deploy workflow checks out `adamsimms/pinchards.is`, builds the static archive with PHP, assembles into `dist`, deploys Pages. `repository_dispatch` type `cloudberry-archive-rebuild` supported for rebuilds from the archive repo (wire later).

**Important:** Only **GitHub Actions** should deploy this project. If the Cloudflare dashboard also has a Git-connected build (`npm run build` without assemble), it can overwrite production and break `/cloudberry/archive` assets. In the Pages project → **Settings → Builds**, **Disconnect** the GitHub repo (or disable automatic deployments) so Wrangler/GHA is the sole publisher.
