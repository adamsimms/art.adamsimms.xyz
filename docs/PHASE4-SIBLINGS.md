# Sibling apps on art.adamsimms.xyz

Sibling GitHub repos assemble into the art Pages project at deploy:

| App | Repo | Canonical path | API |
|-----|------|----------------|-----|
| Dory | `adamsimms/dory` | `/dory/` | none (Sketchfab) |
| Adrift | `adamsimms/adrift` | `/adrift/experience/` | `/adrift/api/weather` (Pages Function) |
| Waves | `adamsimms/waves` | `/waves/` | `/waves/call-api`, `/waves/health` |
| Cloudberry | `adamsimms/cloudberry-archive` | `/cloudberry/archive/` | static catalog |
| Dreamberry | `adamsimms/dreamberry` | `/dreamberry/` (+ `/window/`, `/info/`) | R2 live pointer at `dreamberry.adamsimms.xyz` |

Portfolio pages `/adrift` (and others) stay Astro work pages; experience CTA links into the assembled app.

## Local

```bash
npm run build:full
# or individually after astro build:
npm run assemble:dory
npm run assemble:adrift
npm run assemble:waves
npm run assemble:dreamberry
```

Env overrides: `DORY_REPO_PATH`, `ADRIFT_REPO_PATH`, `WAVES_REPO_PATH`, `CLOUDBERRY_ARCHIVE_REPO_PATH` (alias `PINCHARDS_REPO_PATH`), `DREAMBERRY_REPO_PATH`.

## CI

Art deploy checks out the sibling repos and runs `assemble:siblings`, then `wrangler pages deploy dist` (bundles `functions/`).

## Parity checks

- `/dory/` Sketchfab iframe loads
- `/adrift` → Enter the experience → `/adrift/experience/`
- `/adrift/api/weather` returns `{ source, current }`
- `/waves/` WebGL + `/waves/call-api` JSON every ~10s
- `/dreamberry/` landing; `/dreamberry/window/` live frame + drawer; `/dreamberry/info/` about
- Trailing-slash 308s for each mount
- Legacy `pinchards.is/…` hostnames still redirect to these art paths until the domain expires ([PHASE5-CUTOVER.md](./PHASE5-CUTOVER.md))
