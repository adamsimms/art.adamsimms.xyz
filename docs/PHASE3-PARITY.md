# Cloudberry parity checklist — art.adamsimms.xyz

Canonical archive: `https://art.adamsimms.xyz/cloudberry/archive/`

## Must work

| Check | URL / action | Expect |
|-------|----------------|--------|
| Trailing slash | `/cloudberry/archive` | 308 → `/cloudberry/archive/` |
| Viewer | `/cloudberry/archive/` | Photo + timeline; catalogs JS |
| Query deep-link | `/cloudberry/archive/?filename=GOPR4132.JPG` (any real name) | That frame loads |
| Play | Play toggle / `?play=1` | Crossfade slideshow |
| Scrub while playing | Drag timeline during play | Seeks (interrupts fade) |
| Gallery | `/cloudberry/archive/gallery/` | Grid + links back to viewer |
| Info | `/cloudberry/archive/info/` | About + monospace citation blocks + Copy |
| Jam | `/cloudberry/archive/jam/` | Fullscreen kiosk slideshow |
| Maps hub | `/maps`, `/maps/trees`, `/maps/resettled` | Mapbox tiles (pk token allowlisted) |
| Portfolio CTA | `/cloudberry` → Enter the archive | `/cloudberry/archive/` |
| Legacy path aliases | Old gallery/info/slideshow URL shapes under `/cloudberry/archive/` | 301 to clean paths |
| Assets | `/cloudberry/archive/js/viewer.js` | `application/javascript` (not HTML) |
| Catalog | `/cloudberry/archive/data/catalog.json` | JSON catalog |
| Media | Image from `cloudberry-images.adamsimms.xyz` | 200 JPEG |
| Umami | View source on archive HTML | `cloud.umami.is/script.js` + website id |
| CSP-RO | Response headers | `Content-Security-Policy-Report-Only` present |

## Ops

| Check | Expect |
|-------|--------|
| Pages Git auto-build | Disabled — only GHA/Wrangler deploys |
| pinchards → art | `repository_dispatch` type `cloudberry-archive-rebuild` (needs `ART_DISPATCH_TOKEN` on pinchards) |
| Art push / dispatch | Workflow builds archive + assembles + deploys |
| pinchards.is | Worker redirects → art paths (see [PHASE5-CUTOVER.md](./PHASE5-CUTOVER.md)) |
