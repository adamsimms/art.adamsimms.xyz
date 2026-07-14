# Phase 5 — Cutover

Canonical host is **`art.adamsimms.xyz`**. `pinchards.is` / `www` redirect onto art paths (citation window). No vanity project subdomains.

## What shipped in git

| Piece | Status |
|-------|--------|
| Redirect Worker | [`workers/pinchards-redirect`](../workers/pinchards-redirect/) — deploy once token allows Workers Edit |
| Bulk Redirects map | [`PHASE5-REDIRECTS.json`](./PHASE5-REDIRECTS.json) + [`PHASE5-REDIRECTS.csv`](./PHASE5-REDIRECTS.csv) |
| DreamHost rsync | Disabled on push for pinchards / dory / adrift / waves (`workflow_dispatch` only) |
| Waves uptime | Probes `art.adamsimms.xyz/waves/*` |
| adamsimms.xyz links | Point at art paths |

Query strings (e.g. `?filename=`) are preserved once redirects are live.

## Finish redirects (pick one)

The art Pages API token can deploy Pages but **not** Workers scripts or Bulk Redirect lists (Auth 10000). Do one of:

### A — Dashboard Bulk Redirects (fastest)

1. Cloudflare Dashboard → **Account** → **Bulk Redirects**
2. Create list `pinchards_to_art`, upload [`PHASE5-REDIRECTS.csv`](./PHASE5-REDIRECTS.csv)
3. Add a Bulk Redirect **rule** that enables the list
4. Keep `pinchards.is` / `www` **proxied**

### B — Expand API token, then re-run

On the GitHub secret `CLOUDFLARE_API_TOKEN`, add:

- Account → **Workers Scripts** → Edit  
- Account → **Workers Routes** → Edit *(or Zone Workers Routes)*  
- Account → **Account Filter Lists** → Edit  
- Account → **Bulk URL Redirects** → Edit  

Then either:

```bash
gh workflow run deploy-pinchards-redirect.yml -R adamsimms/art.adamsimms.xyz
# or
gh workflow run apply-pinchards-redirects.yml -R adamsimms/art.adamsimms.xyz
```

### C — Local Wrangler

```bash
cd workers/pinchards-redirect
npx wrangler login
npx wrangler deploy
```

## Manual ops (Adam)

Do these **after** redirects smoke green:

1. Confirm nothing important still hits CloudFront `d3kq73…` / `d35wkp…`.
2. Delete or empty CloudFront distributions + S3 buckets `shutter-island` / `shutter-island-thumbnails`.
3. Delete gallery IAM user/keys; remove `AWS_*` GitHub secrets from pinchards (siblings if any).
4. DreamHost panel — cancel host / stop paying.
5. Later: stop renewing `.is` when the citation window is done (keep DNS redirect-only until then).

## Smoke checklist

```bash
curl -sSI 'https://www.pinchards.is/' | grep -iE 'HTTP/|location'
curl -sSI 'https://www.pinchards.is/info.php' | grep -iE 'HTTP/|location'
curl -sSI 'https://www.pinchards.is/dory/' | grep -iE 'HTTP/|location'
curl -sSI 'https://www.pinchards.is/adrift/' | grep -iE 'HTTP/|location'
curl -sSI 'https://www.pinchards.is/waves/' | grep -iE 'HTTP/|location'
curl -sSI 'https://www.pinchards.is/maps/' | grep -iE 'HTTP/|location'
curl -sSI 'https://www.pinchards.is/?filename=test.jpg' | grep -iE 'HTTP/|location'
```

Expect **301** with `Location: https://art.adamsimms.xyz/...`.
