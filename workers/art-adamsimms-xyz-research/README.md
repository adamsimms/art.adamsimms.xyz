# Research email inbox

Capture address: `research@adamsimms.xyz` → Worker `art-adamsimms-xyz-research` → private R2 `art-adamsimms-xyz-research`.

## Behaviour

1. Allowlist envelope From (`adamsimms@gmail.com`, `hello@adamsimms.xyz`)
2. Message-ID hard dedupe; same URL still stores a new item with `duplicateUrlOf`
3. Write `raw.eml` + `meta.json` + email attachments (size-capped)
4. Async: OG metadata and/or download linked PDF/file into `attachments/`

Silent accept — no auto-reply. Does **not** create `/research` markdown (phase 3).

## Local test

```bash
cd workers/art-adamsimms-xyz-research
npm install
npx wrangler dev
```

Then POST a raw RFC822 message (must include `Message-ID`) to the local email handler — see [Cloudflare Email Workers local development](https://developers.cloudflare.com/email-service/local-development/routing/).

## Deploy

```bash
cd workers/art-adamsimms-xyz-research
npx wrangler deploy
```

Wire Email Routing on **adamsimms.xyz**: destination Worker `art-adamsimms-xyz-research` for `research@adamsimms.xyz`. Full checklist: [docs/RESEARCH-INBOX.md](../../docs/RESEARCH-INBOX.md).
