# Research inbox (email capture + enrichment)

Mail to **`research@adamsimms.xyz`** is stored in private R2. It does **not** publish to `/research` until you promote in admin.

## Resources

| Piece | Value |
| --- | --- |
| Address | `research@adamsimms.xyz` |
| Zone | `adamsimms.xyz` (Email Routing) |
| Inbox Worker | `art-adamsimms-xyz-research` ([`workers/art-adamsimms-xyz-research/`](../workers/art-adamsimms-xyz-research/)) |
| Admin Worker | `art-adamsimms-xyz-research-admin` ([`workers/art-adamsimms-xyz-research-admin/`](../workers/art-adamsimms-xyz-research-admin/)) |
| Shared enrich | [`workers/shared/research-enrich/`](../workers/shared/research-enrich/) |
| Queue | `art-adamsimms-xyz-research-enrich` |
| R2 bucket | `art-adamsimms-xyz-research` (private — no public CDN yet) |
| Allowlist | `adamsimms@gmail.com`, `hello@adamsimms.xyz` (envelope From) |
| LLM | Workers AI `@cf/meta/llama-3.1-8b-instruct` |

## Flow

1. Email accepted → `raw.eml` + `meta.json` (`enrichment.status: queued`)
2. Message enqueued on `art-adamsimms-xyz-research-enrich`
3. Consumer runs deep enrich (OG/file, HTML reader, DOI/ISBN, Crossref/Open Library, PDF text, Wayback, Workers AI, graph hints)
4. Admin triage → promote commits `src/content/research/<slug>.md` + rebuilds R2 indexes

## Enrichment stages

| Stage | What |
| --- | --- |
| `og` | SSRF-safe fetch → Open Graph or store linked file |
| `reader` | Capped HTML plain-text excerpt (~4k) — not written to git |
| `ids` | DOI / ISBN from URL or PDF bytes |
| `bib` | Crossref / Open Library → citation suggestions |
| `pdf` | Rough PDF text (~8k / first ~2MB scan) |
| `archive` | Wayback Save Page Now (best-effort; never blocks promote) |
| `llm` | Workers AI suggestions (tags, type, related*, summary) |
| `graph` | Overlap hints vs `library/index.json` + `site/works.json` + `site/writing.json` |

Statuses: `queued` → `running` → `ok` | `partial` | `failed` | `skipped`. Soft URL duplicates may copy prior enrichment unless Force re-enrich.

Provenance chips in admin show field sources (`og`, `crossref`, `openlibrary`, `llm`, `subject`, `body`, …).

### Caps / hygiene

- Per-stage timeouts; one failure → `partial`, pipeline continues
- Crossref User-Agent includes `mailto:hello@adamsimms.xyz`
- Prefer existing tags; LLM `newTags` kept separate
- Re-enrich skips concurrent `running`; skips Wayback re-SPN unless Force archive
- Reader/PDF excerpts stay in inbox meta — not committed on promote by default

## R2 layout

```
inbox/YYYY/MM/DD/<id>/
  meta.json
  raw.eml
  attachments/<n>-<name>
inbox/by-message-id/<sha256>.json
inbox/by-url/<sha256>.json
files/<slug>/…
library/index.json
site/works.json
site/writing.json
```

## Limits (capture)

| Limit | Value |
| --- | --- |
| Soft max raw MIME | 15 MB |
| Max per attachment / linked file | 10 MB |
| Body text in meta | 16 KB |
| Enrich fetch / stage timeout | ~8–12 s (LLM ~20 s) |

Signature / personal hosts are never chosen as `primaryUrl`.

## Admin

[`https://art.adamsimms.xyz/research/admin`](https://art.adamsimms.xyz/research/admin) (Cloudflare Access)

- Enrichment card, re-enrich (URL override), list badges
- Refresh site indexes
- Promote with related research / works / writing

## Deploy

```bash
cd workers/art-adamsimms-xyz-research && npx wrangler deploy
cd workers/art-adamsimms-xyz-research-admin && npx wrangler deploy
```

Queue is created once: `npx wrangler queues create art-adamsimms-xyz-research-enrich`

## Still deferred

Public research-media CDN, OG image → `image` field, visual research map (3b), nav/sitemap go-live.
