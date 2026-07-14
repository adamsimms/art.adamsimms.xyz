# Cutover — pinchards.is → art.adamsimms.xyz

Canonical host is **`art.adamsimms.xyz`**. `pinchards.is` / `www` redirect onto art paths (citation window). No vanity project subdomains.

## Live

| Piece | Detail |
|-------|--------|
| Redirect Worker | `pinchards-redirect` — [`workers/pinchards-redirect`](../workers/pinchards-redirect/) |
| Redirect map (reference) | [`PHASE5-REDIRECTS.json`](./PHASE5-REDIRECTS.json) / [`PHASE5-REDIRECTS.csv`](./PHASE5-REDIRECTS.csv) |
| Sibling publish | Content ships only via art Pages assemble (sibling repos no longer auto-publish to the old host) |
| Waves uptime | Probes `art.adamsimms.xyz/waves/*` |

Query strings (e.g. `?filename=`) are preserved.

## Update the Worker

```bash
gh workflow run deploy-pinchards-redirect.yml -R adamsimms/art.adamsimms.xyz
# or locally:
cd workers/pinchards-redirect && npx wrangler deploy
```

DNS for `pinchards.is` / `www` must stay **proxied (orange cloud)**.

API token needs Account Pages + Workers Scripts Edit, Zone Workers Routes Edit (include `pinchards.is`), and optionally Bulk URL Redirects / Filter Lists if using the Bulk Redirects apply workflow.

## Optional Bulk Redirects

```bash
gh workflow run apply-pinchards-redirects.yml -R adamsimms/art.adamsimms.xyz
```

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

## After soak

When citations no longer need the `.is` hostname: stop renewing the domain (keep redirects until then). Gallery media is on R2 (`cloudberry-images|thumbs.adamsimms.xyz`) — retire any leftover third-party object storage / CDN manually once unused.
