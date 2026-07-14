# Sibling apps on art.adamsimms.xyz

Three separate GitHub repos assemble into the art Pages project at deploy:

| App | Repo | Canonical path | API |
|-----|------|----------------|-----|
| Dory | `adamsimms/dory` | `/dory/` | none (Sketchfab) |
| Adrift | `adamsimms/adrift` | `/adrift/experience/` | `/adrift/api/weather` (Pages Function) |
| Waves | `adamsimms/waves` | `/waves/` | `/waves/call-api`, `/waves/health` |
| Cloudberry | `adamsimms/pinchards.is` | `/cloudberry/archive/` | static catalog |

Portfolio pages `/adrift` (and others) stay Astro work pages; experience CTA links into the assembled app.

## Local

```bash
npm run build:full
# or individually after astro build:
npm run assemble:dory
npm run assemble:adrift
npm run assemble:waves
```

Env overrides: `DORY_REPO_PATH`, `ADRIFT_REPO_PATH`, `WAVES_REPO_PATH`, `PINCHARDS_REPO_PATH`.

## CI

Art deploy checks out all four sibling repos and runs `assemble:siblings`, then `wrangler pages deploy dist` (bundles `functions/`).

## Parity checks

- `/dory/` Sketchfab iframe loads
- `/adrift` → Enter the experience → `/adrift/experience/`
- `/adrift/api/weather` returns `{ source, current }`
- `/waves/` WebGL + `/waves/call-api` JSON every ~10s
- Trailing-slash 308s for each mount
- `pinchards.is/…` redirects to these art paths ([PHASE5-CUTOVER.md](./PHASE5-CUTOVER.md))
