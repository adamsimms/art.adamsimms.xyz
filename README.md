# art.adamsimms.xyz

Photography and art portfolio on Astro 7 / Cloudflare Pages (`art.adamsimms.xyz`).

## Stack

- Astro 7 (static output)
- Cloudflare Pages (`art.adamsimms.xyz`)
- R2 (`media.adamsimms.xyz`, Cloudberry image buckets)
- Pages Functions (Adrift weather, Waves buoy API)
- Umami analytics (shared with `adamsimms.xyz`)
- Assemble-at-deploy for Cloudberry archive + Dory / Adrift / Waves

## Development

Requires Node.js 22.12+.

```bash
npm install
npm run dev
```

## Deploy

```bash
npm run deploy
# or: npm run build:full && npx wrangler pages deploy dist --project-name=art-adamsimms-xyz
```

See [DEPLOYMENT.md](./DEPLOYMENT.md). Assemble notes: [docs/CLOUDBERRY-ASSEMBLE.md](./docs/CLOUDBERRY-ASSEMBLE.md). Cutover: [docs/PHASE5-CUTOVER.md](./docs/PHASE5-CUTOVER.md).

## URL structure

Flat work URLs (`/sublime`, `/cloudberry`, …). Archive: `/cloudberry/archive/`. Experiences: `/dory/`, `/adrift/experience/`, `/waves/`.
