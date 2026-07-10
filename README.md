# art.adamsimms.xyz

Photography and art portfolio migrated from Squarespace (`adamsim.ms`) to Astro 7 on Cloudflare Pages.

## Stack

- Astro 7 (static output)
- Cloudflare Pages (`art.adamsimms.xyz`)
- R2 (`media.adamsimms.xyz`)
- Umami analytics (shared with `adamsimms.xyz`)

## Development

Requires Node.js 22.12+.

```bash
npm install
npm run dev
```

## Migration

Scrape Squarespace, generate content, download and convert images:

```bash
npm run migrate
```

Upload staged images to R2 (requires Wrangler auth):

```bash
npm run upload:media
```

## Deploy

```bash
npm run deploy
```

See [DEPLOYMENT.md](./DEPLOYMENT.md) for Cloudflare setup and cutover steps.

## URL structure

Flat work URLs are preserved from Squarespace (`/sublime`, not `/work/sublime`). `/home` and `/intro` redirect to `/`.
