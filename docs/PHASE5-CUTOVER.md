# Phase 5 — Cutover

Canonical host is **`art.adamsimms.xyz`**. `pinchards.is` / `www` redirect onto art paths (citation window). No vanity project subdomains.

## What shipped

| Piece | Status |
|-------|--------|
| Redirect Worker | `pinchards-redirect` — [`workers/pinchards-redirect`](../workers/pinchards-redirect/) |
| Redirect map (reference) | [`PHASE5-REDIRECTS.json`](./PHASE5-REDIRECTS.json) |
| Bulk Redirects script (optional) | `npm run redirects:pinchards` — needs Account Filter Lists + Bulk URL Redirects Edit on the API token |
| DreamHost rsync | Disabled on push for pinchards / dory / adrift / waves (`workflow_dispatch` only) |
| Waves uptime | Probes `art.adamsimms.xyz/waves/*` |
| Assembled apps | Still built into art Pages deploy |

Query strings (e.g. `?filename=`) are preserved on redirects.

## Deploy / update Worker

```bash
gh workflow run deploy-pinchards-redirect.yml -R adamsimms/art.adamsimms.xyz
# or locally:
cd workers/pinchards-redirect && npx wrangler deploy
```

DNS for `pinchards.is` / `www` must stay **proxied (orange cloud)** so Worker routes run.

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
