# Newsletter (Workers + D1)

Based on [pfstr/newsletter-template](https://github.com/pfstr/newsletter-template) (MIT). Capture, unsubscribe, optional campaign send — subscribers live in D1 on this Cloudflare account.

| | |
| --- | --- |
| Worker | `art-adamsimms-xyz-newsletter` |
| D1 | `art-adamsimms-xyz-newsletter` (`DB` binding) |
| Public URLs | `https://art.adamsimms.xyz/newsletter` · `/newsletter/admin` |
| Site form | Footer `NewsletterSignup` → `POST …/newsletter/api/subscribe` |
| Sending | [Resend](https://resend.com) via `RESEND_API_KEY` (see below) |

Workers.dev still works for debugging:
`https://art-adamsimms-xyz-newsletter.adamsimms-xyz-1bf.workers.dev`

## Why Resend (not Cloudflare Email Sending)

Cloudflare Email Service is for **transactional** mail only. Newsletter / campaign blasts need a bulk-friendly sender — Resend fits small lists and wires cleanly from a Worker.

## Deploy

```bash
cd workers/art-adamsimms-xyz-newsletter
npm ci
npx wrangler secret put ADMIN_TOKEN
npx wrangler secret put RESEND_API_KEY   # after creating a Resend account
npx wrangler deploy                      # applies D1 migrations + zone routes
```

Also set Worker vars (dashboard or `wrangler.json`):

- `PUBLIC_URL` = `https://art.adamsimms.xyz/newsletter` (already set)
- `SENDER_ADDRESS` = your real postal address (required before campaigns; CAN-SPAM)
- optional: `NOTIFY_EMAIL`, `DOUBLE_OPT_IN`, Turnstile keys

GitHub Actions variable `PUBLIC_NEWSLETTER_URL` should match `PUBLIC_URL`.

## Enable sending

1. Sign up at [resend.com](https://resend.com) and **verify `adamsimms.xyz`** (DNS SPF/DKIM they provide).
2. `npx wrangler secret put RESEND_API_KEY`
3. Set `SENDER_ADDRESS` (physical mailing address for email footers).
4. Open `https://art.adamsimms.xyz/newsletter/admin`, paste `ADMIN_TOKEN`, send a test to yourself, then queue a campaign.

`FROM_EMAIL` defaults to `hello@adamsimms.xyz` — that address must be allowed on the verified Resend domain.

## Useful commands

```bash
npm run dev

npx wrangler d1 execute art-adamsimms-xyz-newsletter --remote \
  --command "SELECT email, status, created_at FROM subscribers ORDER BY created_at DESC LIMIT 50"
```

Upstream template docs: [README.md](./README.md) · [CHANGELOG.md](./CHANGELOG.md).
