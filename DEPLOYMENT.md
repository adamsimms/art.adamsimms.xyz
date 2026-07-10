# Deployment — art.adamsimms.xyz

## Cloudflare resources

| Resource | Name / value |
| --- | --- |
| GitHub repo | `adamsimms/art.adamsimms.xyz` |
| Pages project | `art-adamsimms-xyz` |
| Custom domain | `art.adamsimms.xyz` |
| R2 bucket | `art-adamsimms-xyz` |
| R2 public domain | `media.adamsimms.xyz` |

## Initial setup

1. Create the Pages project and connect the `adamsimms/art.adamsimms.xyz` GitHub repo.
2. Create R2 bucket `art-adamsimms-xyz` and enable public access at `media.adamsimms.xyz`.
3. Add DNS CNAME records:
   - `art` → Pages project
   - `media` → R2 public bucket domain
4. Set GitHub Actions secrets: `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`.
5. Set GitHub variable: `UMAMI_WEBSITE_ID` (same as `adamsimms.xyz`).

## Media upload

After running `npm run migrate:images`:

```bash
npx wrangler login
npm run upload:media
```

Images are stored as AVIF (primary) + JPEG (fallback) at:

- `work/<slug>/NN.avif`
- `work/<slug>/NN.jpg`

Pages use `<picture>` so browsers that support AVIF get it; others get JPEG.

If an earlier WebP upload already ran, re-run `npm run upload:media` after re-encoding — new keys overwrite by path; leftover `.webp` objects can be deleted from the bucket later.

## Cutover (after QA)

1. Deploy and QA on Pages preview URL.
2. Attach `art.adamsimms.xyz` and spot-check all work pages, about, resume, blog.
3. Enable redirect on `adamsim.ms` in Cloudflare:

   ```
   adamsim.ms/* → https://art.adamsimms.xyz/:splat (301)
   ```

4. Keep Squarespace live 1–2 weeks as fallback.

## Redirects (in-repo)

`public/_redirects` handles:

- `/home` → `/`
- `/intro` → `/`
- `/blog/tag/*` → `/blog`
