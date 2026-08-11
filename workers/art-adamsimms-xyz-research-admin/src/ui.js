import { formatChicagoCitation, researchCitation } from '../../shared/chicago.js';

/**
 * Admin UI with site chrome (header + left-aligned sheet) matching /research (cv variant).
 * @param {{ title: string, body: string, active?: string, compactHeader?: boolean, headExtra?: string }} opts
 */
export function layout(opts) {
	const active = opts.active || 'inbox';
	const compact = Boolean(opts.compactHeader);
	const pageHeader = compact
		? `<header class="page-header page-header--compact">
        <nav class="admin-nav" aria-label="Admin">
          <a href="/research/admin/" ${active === 'inbox' ? 'aria-current="page"' : ''}>Inbox</a>
          <a href="/research/admin/library" ${active === 'library' ? 'aria-current="page"' : ''}>Library</a>
        </nav>
      </header>`
		: `<header class="page-header">
        <h1>Research</h1>
        <p class="research__lead">Admin — inbox triage and library. Not public.</p>
        <nav class="admin-nav" aria-label="Admin">
          <a href="/research/admin/" ${active === 'inbox' ? 'aria-current="page"' : ''}>Inbox</a>
          <a href="/research/admin/library" ${active === 'library' ? 'aria-current="page"' : ''}>Library</a>
        </nav>
      </header>`;

	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex"/>
<meta name="theme-color" content="#fafafa"/>
${opts.headExtra || ''}
<title>${escapeHtml(opts.title)} · Research admin · Adam Simms</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg?v=berry-orange"/>
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,wght@8..144,1..1000&family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap" rel="stylesheet"/>
<style>
:root {
  color-scheme: light;
  --text: #1a1a1a;
  --muted: #666;
  --bg: #fff;
  --border: #e5e5e5;
  --danger: #c0392b;
  --danger-hover: #a93226;
  --amber: #d97706;
  --amber-hover: #b45309;
  --secondary: #3a3a3a;
  --secondary-hover: #2a2a2a;
  --soft: #e8e8e8;
  --soft-hover: #dcdcdc;
  --font-display: "Google Sans Flex", system-ui, sans-serif;
  --font-body: Inter, system-ui, sans-serif;
  --step--1: clamp(0.8333rem, 0.8061rem + 0.1212vw, 0.9rem);
  --type-caption: var(--step--1);
  --type-nav: clamp(0.9rem, 0.8795rem + 0.0909vw, 0.95rem);
  --type-body: clamp(1rem, 0.9489rem + 0.2273vw, 1.125rem);
  --type-brand: clamp(1.2rem, 1.0977rem + 0.4545vw, 1.45rem);
  --type-display: clamp(2.75rem, 1.8295rem + 4.0909vw, 5rem);
  --type-title: clamp(1.5rem, 1.1114rem + 1.7273vw, 2.45rem);
  --leading-display: 1.05;
  --leading-body: 1.6;
  --leading-tight: 1;
  --tracking-display: -0.03em;
  --space-2xs: clamp(0.5rem, 0.4744rem + 0.1136vw, 0.5625rem);
  --space-xs: clamp(0.75rem, 0.7116rem + 0.1705vw, 0.8438rem);
  --space-s: clamp(1rem, 0.9489rem + 0.2273vw, 1.125rem);
  --space-m: clamp(1.5rem, 1.4233rem + 0.3409vw, 1.6875rem);
  --space-l: clamp(2rem, 1.8977rem + 0.4545vw, 2.25rem);
  --space-xl: clamp(3rem, 2.8466rem + 0.6818vw, 3.375rem);
  --ease: cubic-bezier(0.22, 1, 0.36, 1);
}
* { box-sizing: border-box; }
body {
  margin: 0;
  min-height: 100dvh;
  font-family: var(--font-body);
  font-size: var(--type-body);
  font-optical-sizing: auto;
  line-height: var(--leading-body);
  color: var(--text);
  background: #fff;
}
a { color: inherit; text-decoration: none; }
.site-sheet {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  background: #fff;
}
.site-header {
  position: relative;
  z-index: 3;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1.5rem;
  padding: 2rem 2rem 1.5rem;
  background: transparent;
}
.site-title {
  font-family: var(--font-display);
  font-size: var(--type-brand);
  font-weight: 600;
  letter-spacing: 0;
  line-height: var(--leading-tight);
  text-transform: uppercase;
  color: inherit;
}
.site-title__mark { display: inline-grid; grid-template-areas: "label"; }
.site-title__mono, .site-title__full { grid-area: label; white-space: nowrap; }
.site-title__mono { opacity: 1; transition: opacity 0.9s cubic-bezier(0.4, 0, 0.2, 1); }
.site-title__full { opacity: 0; transition: opacity 0s; }
.site-title:is(:hover, :focus-visible) .site-title__mono { opacity: 0; transition: opacity 0s; }
.site-title:is(:hover, :focus-visible) .site-title__full { opacity: 1; transition: opacity 0.9s cubic-bezier(0.22, 1, 0.36, 1); }
.site-nav ul {
  display: flex; flex-wrap: wrap; gap: 0.65rem 1.35rem;
  list-style: none; margin: 0; padding: 0; font-size: var(--type-nav);
}
.site-nav a { position: relative; color: var(--muted); transition: color 0.45s var(--ease); }
.site-nav a::after {
  content: ""; position: absolute; left: 0; bottom: -0.2em; width: 100%; height: 1px;
  background: currentColor; transform: scaleX(0); transform-origin: left; transition: transform 0.45s var(--ease);
}
.site-nav a:is(:hover, :focus-visible), .site-nav a[aria-current="page"] { color: var(--text); }
.site-nav a:is(:hover, :focus-visible)::after, .site-nav a[aria-current="page"]::after { transform: scaleX(1); }
.main--cv {
  flex: 1 0 auto; max-width: none; margin: 0; padding: 0 2rem 4rem; text-align: left;
}
.research { max-width: none; font-size: var(--type-nav); line-height: 1.5; text-align: left; }
.page-header { margin-bottom: var(--space-l); }
.page-header--compact {
  margin: 0 0 var(--space-s);
  padding-bottom: var(--space-s);
  border-bottom: 1px solid color-mix(in srgb, var(--text) 10%, transparent);
}
.page-header h1 {
  margin: 0 0 var(--space-2xs); font-family: var(--font-display); font-size: var(--type-display);
  font-weight: 500; font-optical-sizing: auto; letter-spacing: var(--tracking-display); line-height: var(--leading-display);
}
.research__lead {
  max-width: 38rem; margin: 0 0 var(--space-s);
  color: color-mix(in srgb, var(--text) 78%, var(--muted));
}
.admin-nav {
  display: flex; flex-wrap: wrap; gap: 0.85rem 1.5rem;
  font-size: var(--type-nav); letter-spacing: 0.01em;
}
.admin-nav a { position: relative; color: var(--muted); transition: color 0.45s var(--ease); }
.admin-nav a::after {
  content: ""; position: absolute; left: 0; bottom: -0.2em; width: 100%; height: 1px;
  background: currentColor; transform: scaleX(0); transform-origin: left; transition: transform 0.45s var(--ease);
}
.admin-nav a:hover, .admin-nav a[aria-current="page"] { color: var(--text); }
.admin-nav a[aria-current="page"]::after, .admin-nav a:hover::after { transform: scaleX(1); }
.research-filters {
  display: flex; flex-wrap: wrap; gap: var(--space-s) var(--space-m);
  margin: 0 0 var(--space-l); padding-bottom: var(--space-s);
  border-bottom: 1px solid color-mix(in srgb, var(--text) 12%, transparent);
}
.research-filters a {
  font-size: var(--type-caption); color: var(--muted); letter-spacing: 0.02em; transition: color 0.35s var(--ease);
}
.research-filters a[aria-current="page"], .research-filters a:hover { color: var(--text); }
.research-list { list-style: none; margin: 0; padding: 0; }
.research-list__item { border-bottom: 1px solid color-mix(in srgb, var(--text) 8%, transparent); }
.research-list__link {
  display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between;
  gap: 0.35rem 1.25rem; padding: 0.85rem 0; color: inherit; transition: color 0.35s var(--ease);
}
.research-list__link:is(:hover, :focus-visible) .research-list__title { color: var(--text); }
.research-list__title { font-weight: 500; color: color-mix(in srgb, var(--text) 92%, var(--muted)); }
.research-list__meta {
  display: flex; flex-wrap: wrap; gap: 0.35rem 0.85rem; font-size: var(--type-caption); color: var(--muted);
}
.research-back {
  margin: 0 0 var(--space-xs);
  font-size: var(--type-caption);
}
.research-back a {
  color: var(--muted);
  border-bottom: 1px solid transparent;
}
.research-back a:is(:hover, :focus-visible) {
  color: var(--text);
  border-bottom-color: color-mix(in srgb, var(--text) 30%, transparent);
}
.research-summary {
  max-width: 38rem; margin: 0 0 var(--space-m);
  color: color-mix(in srgb, var(--text) 82%, var(--muted));
}
.research-summary a {
  color: var(--text); border-bottom: 1px solid color-mix(in srgb, var(--text) 22%, transparent);
}
.research__empty { margin: 0; color: var(--muted); }
.detail-title {
  margin: 0; font-family: var(--font-display); font-size: var(--type-title);
  font-weight: 500; letter-spacing: var(--tracking-display); line-height: 1.15;
}

/* Buttons — solid fills, easy to scan */
.btn, button.btn {
  font-family: var(--font-body); font-size: var(--type-caption); padding: 0.5rem 0.95rem;
  border: 1px solid transparent; border-radius: 0;
  background: var(--soft); color: var(--text); cursor: pointer; display: inline-block;
  letter-spacing: 0.01em; font-weight: 500;
  transition: color 0.2s var(--ease), background 0.2s var(--ease), border-color 0.2s var(--ease), opacity 0.2s var(--ease);
}
.btn:hover { background: var(--soft-hover); }
.btn:active { opacity: 0.9; }
.btn:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; }
.btn:disabled, .btn[aria-disabled="true"] { opacity: 0.4; pointer-events: none; }
.btn.btn--primary,
button.btn--primary {
  background: #111; color: #fff; border-color: #111;
}
.btn.btn--primary:hover,
button.btn--primary:hover,
.btn.btn--primary:active,
button.btn--primary:active { background: #000; border-color: #000; color: #fff; }
.btn.btn--secondary,
button.btn--secondary {
  background: var(--secondary); color: #fff; border-color: var(--secondary);
}
.btn.btn--secondary:hover,
button.btn--secondary:hover,
.btn.btn--secondary:active,
button.btn--secondary:active { background: var(--secondary-hover); border-color: var(--secondary-hover); color: #fff; }
.btn.btn--ghost,
button.btn--ghost,
.btn.btn--amber,
button.btn--amber {
  background: var(--amber); color: #fff; border-color: var(--amber);
}
.btn.btn--ghost:hover,
button.btn--ghost:hover,
.btn.btn--amber:hover,
button.btn--amber:hover,
.btn.btn--ghost:active,
button.btn--ghost:active,
.btn.btn--amber:active,
button.btn--amber:active { background: var(--amber-hover); border-color: var(--amber-hover); color: #fff; }
.btn.btn--ghost:focus-visible,
button.btn--ghost:focus-visible,
.btn.btn--amber:focus-visible,
button.btn--amber:focus-visible { outline-color: var(--amber); }
.btn.btn--danger,
button.btn--danger {
  background: var(--danger); color: #fff; border-color: var(--danger);
}
.btn.btn--danger:hover,
button.btn--danger:hover,
.btn.btn--danger:active,
button.btn--danger:active { background: var(--danger-hover); border-color: var(--danger-hover); color: #fff; }
.btn.btn--danger:focus-visible,
button.btn--danger:focus-visible { outline-color: var(--danger); }

.actions { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; margin: 0; }
.actions form { display: inline; margin: 0; }

form.stack {
  display: flex; flex-direction: column; gap: var(--space-s); margin: 0; max-width: none;
}
.admin-panel form.stack { gap: var(--space-xs); }
label {
  display: flex; flex-direction: column; gap: 0.2rem; font-size: var(--type-caption);
  color: var(--muted); letter-spacing: 0.02em;
}
.inline-code {
  font-family: var(--font-body); font-size: 0.92em;
  color: color-mix(in srgb, var(--text) 78%, var(--muted));
}
.field-hint {
  margin: 0; font-size: 0.7rem; color: color-mix(in srgb, var(--muted) 85%, transparent); letter-spacing: 0.02em;
}
.option-card {
  display: flex; gap: 0.65rem; align-items: flex-start;
  margin: 0; padding: 0.65rem 0.75rem;
  border: 1px solid color-mix(in srgb, var(--text) 12%, transparent);
  background: color-mix(in srgb, var(--text) 3%, var(--bg));
  cursor: pointer;
}
.option-card input {
  margin: 0.2rem 0 0; flex: 0 0 auto; width: 1rem; height: 1rem;
}
.option-card__text { display: flex; flex-direction: column; gap: 0.15rem; min-width: 0; }
.option-card__label {
  font-size: var(--type-caption); font-weight: 500; color: var(--text); letter-spacing: 0.01em;
}
.option-card__help {
  font-size: 0.7rem; line-height: 1.4; color: var(--muted); letter-spacing: 0;
}
.enrich-actions {
  display: flex; flex-wrap: wrap; gap: 0.5rem; align-items: center; margin-top: var(--space-xs);
}
input, select, textarea {
  font-family: var(--font-body); font-size: var(--type-nav); color: var(--text); background: var(--bg);
  border: 1px solid color-mix(in srgb, var(--text) 18%, transparent); border-radius: 0; padding: 0.4rem 0.5rem;
}
textarea { min-height: 5rem; line-height: 1.5; }
.flash {
  padding: var(--space-2xs) var(--space-xs); margin: 0 0 var(--space-m);
  border: 1px solid color-mix(in srgb, var(--text) 12%, transparent); font-size: var(--type-caption); max-width: none;
}
.flash.err { border-color: color-mix(in srgb, var(--danger) 50%, var(--border)); color: var(--danger); }
.flash a { color: var(--text); border-bottom: 1px solid color-mix(in srgb, var(--text) 22%, transparent); }
pre.block {
  white-space: pre-wrap; font-family: var(--font-body); font-size: var(--type-caption); line-height: 1.45;
  max-width: none; margin: 0; padding: var(--space-xs);
  background: color-mix(in srgb, var(--text) 4%, var(--bg));
  color: color-mix(in srgb, var(--text) 82%, var(--muted));
}
.pdf-embed {
  display: block; width: 100%; height: min(70vh, 36rem); margin-top: 0.5rem;
  border: 1px solid color-mix(in srgb, var(--text) 12%, transparent);
  background: color-mix(in srgb, var(--text) 3%, var(--bg));
}
.file-list { list-style: none; margin: 0; padding: 0; font-size: var(--type-caption); color: var(--muted); }
.file-list li { margin: 0.35rem 0; }
.file-list a { color: var(--text); border-bottom: 1px solid color-mix(in srgb, var(--text) 22%, transparent); }
.badge {
  display: inline-block; font-size: 0.75em; letter-spacing: 0.02em;
  padding: 0.1rem 0.35rem; border: 1px solid color-mix(in srgb, var(--text) 14%, transparent);
  color: var(--muted); margin-right: 0.15rem;
}
.badge--ok { border-color: color-mix(in srgb, #2a6 35%, transparent); color: #2a6644; }
.badge--warn { border-color: color-mix(in srgb, #a80 40%, transparent); color: #8a6a20; }
.badge--fail { border-color: color-mix(in srgb, var(--danger) 40%, transparent); color: var(--danger); }
details { margin: 0.5rem 0 0; font-size: var(--type-caption); color: var(--muted); }
details summary { cursor: pointer; color: var(--text); }
details pre.block { margin-top: 0.5rem; }

/* Item triage layout — nav → back → meta → title → actions */
.item-top { margin-bottom: var(--space-l); }
.item-meta {
  display: flex; flex-wrap: wrap; align-items: center; gap: 0.35rem 0.5rem;
  margin: 0 0 var(--space-xs); font-size: var(--type-caption); color: var(--muted);
}
.item-meta__sep { opacity: 0.35; user-select: none; }
.item-title-row { margin: 0 0 var(--space-s); }
.item-title-row .detail-title { margin: 0; }
.item-triage { margin: 0; }

.admin-grid {
  display: grid;
  gap: var(--space-m);
  grid-template-columns: 1fr;
  align-items: start;
}
@media (min-width: 56rem) {
  .admin-grid {
    grid-template-columns: minmax(0, 0.95fr) minmax(0, 1.35fr);
    gap: var(--space-l);
  }
  .admin-col--promote { position: sticky; top: 1rem; }
}
.admin-col { display: flex; flex-direction: column; gap: var(--space-m); min-width: 0; }
.admin-panel {
  border: 1px solid color-mix(in srgb, var(--text) 12%, transparent);
  padding: var(--space-s) var(--space-m);
  background: #fff;
}
.admin-panel__title {
  margin: 0 0 var(--space-xs);
  font-size: var(--type-caption);
  font-weight: 500;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
}
.admin-panel__body { margin: 0; }
.admin-panel .research-summary { margin-bottom: var(--space-xs); max-width: none; }
.admin-panel pre.block { margin-bottom: 0; }
.stage-chips {
  display: flex; flex-wrap: wrap; gap: 0.35rem;
  margin: 0 0 var(--space-xs); padding: 0; list-style: none;
}
.stage-chips li {
  font-size: 0.7rem; letter-spacing: 0.02em;
  padding: 0.15rem 0.4rem;
  border: 1px solid color-mix(in srgb, var(--text) 12%, transparent);
  color: var(--muted);
}
.stage-chips li[data-status="ok"] { color: #2a6644; border-color: color-mix(in srgb, #2a6 30%, transparent); }
.stage-chips li[data-status="failed"] { color: var(--danger); border-color: color-mix(in srgb, var(--danger) 35%, transparent); }
.stage-chips li[data-status="skipped"],
.stage-chips li[data-status="pending"],
.stage-chips li[data-status="running"],
.stage-chips li[data-status="queued"] { color: #8a6a20; border-color: color-mix(in srgb, #a80 30%, transparent); }

.promote-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--space-xs);
}
@media (min-width: 40rem) {
  .promote-grid { grid-template-columns: 1fr 1fr; }
  .promote-grid .span-2 { grid-column: 1 / -1; }
}
.promote-actions { margin-top: var(--space-s); }
.enrich-note {
  margin: 0 0 var(--space-xs); font-size: var(--type-caption);
  color: #8a6a20;
}
.list-toolbar { margin: 0 0 var(--space-m); }

@media (max-width: 40rem) {
  .site-header { padding: 1.25rem 1.25rem 1rem; }
  .main--cv { padding: 0 1.25rem 3rem; }
  .site-title__full { display: none; }
  .admin-panel { padding: var(--space-s); }
}
</style>
</head>
<body class="body--cv">
<div class="site-sheet">
  <header class="site-header">
    <a class="site-title" href="/" aria-label="Adam Simms">
      <span class="site-title__mark" aria-hidden="true">
        <span class="site-title__mono">AS</span>
        <span class="site-title__full">Adam Simms</span>
      </span>
    </a>
    <nav class="site-nav" aria-label="Main">
      <ul>
        <li><a href="/works">Works</a></li>
        <li><a href="/about">About</a></li>
        <li><a href="/cv">CV</a></li>
      </ul>
    </nav>
  </header>
  <main class="main--cv">
    <article class="research">
      ${pageHeader}
      ${opts.body}
    </article>
  </main>
</div>
</body>
</html>`;
}

/** @param {string} s */
export function escapeHtml(s) {
	return String(s ?? '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/** True when enrichment stored a raw PDF syntax dump instead of readable text. */
function looksLikeRawPdfDump(text) {
	if (!text) return true;
	const t = text.trim();
	if (/^%PDF-/i.test(t)) return true;
	if (/\bendobj\b/i.test(t) && /\/(?:Type|Linearized|Filter|Length)\b/.test(t)) return true;
	return false;
}

/**
 * @param {Array<{ field?: string, source?: string, confidence?: number }>} provenance
 * @param {string} field
 */
function provHint(provenance, field) {
	const p = provenance.find((x) => x.field === field);
	if (!p?.source) return '';
	return `<p class="field-hint">${escapeHtml(field)} · ${escapeHtml(String(p.source))}</p>`;
}

/**
 * @param {string} status
 */
function enrichBadgeClass(status) {
	if (status === 'ok') return 'badge badge--ok';
	if (status === 'partial' || status === 'queued' || status === 'running' || status === 'pending') {
		return 'badge badge--warn';
	}
	if (status === 'failed') return 'badge badge--fail';
	return 'badge';
}

/**
 * @param {Array<Record<string, unknown>>} items
 * @param {string} filter
 */
export function inboxListPage(items, filter) {
	const tabs = ['inbox', 'deferred', 'promoted', 'discarded', 'all']
		.map(
			(f) =>
				`<a href="/research/admin/?status=${f}" ${filter === f ? 'aria-current="page"' : ''}>${f}</a>`,
		)
		.join('');

	const rows = items.length
		? items
				.map((item) => {
					const enrich = item.enrichment || {};
					const sug = enrich.suggestions || {};
					const title = sug.title || enrich.title || item.subject || item.id;
					const when = String(item.collectedAt || '').slice(0, 10);
					const estatus = String(enrich.status || '—');
					const match = enrich.libraryMatch
						? `<span title="Already in library">lib:${escapeHtml(String(enrich.libraryMatch.slug))}</span>`
						: '';
					return `<li class="research-list__item">
            <a class="research-list__link" href="/research/admin/item/${escapeHtml(String(item.id))}">
              <span class="research-list__title">${escapeHtml(String(title))}</span>
              <span class="research-list__meta">
                <span>${escapeHtml(String(item.status || ''))}</span>
                <span class="${enrichBadgeClass(estatus)}">${escapeHtml(estatus)}</span>
                ${match}
                <span>${escapeHtml(when)}</span>
                <span>${(item.attachments || []).length} file(s)</span>
              </span>
            </a>
          </li>`;
				})
				.join('')
		: `<p class="research__empty">No items with status “${escapeHtml(filter)}”.</p>`;

	return layout({
		title: 'Inbox',
		active: 'inbox',
		body: `<div class="research-filters" aria-label="Status filter">${tabs}</div>
<p class="list-toolbar">
  <form method="post" action="/research/admin/api/indexes">
    <button class="btn btn--secondary" type="submit">Refresh site indexes</button>
  </form>
</p>
<ul class="research-list">${rows}</ul>`,
	});
}

/**
 * @param {Record<string, unknown>} item
 * @param {{ flash?: string, error?: string }} [opts]
 */
export function inboxItemPage(item, opts = {}) {
	const enrich = /** @type {Record<string, unknown>} */ (item.enrichment || {});
	const sug = /** @type {Record<string, unknown>} */ (enrich.suggestions || {});
	const provenance = Array.isArray(enrich.provenance)
		? /** @type {Array<{ field?: string, source?: string, confidence?: number }>} */ (enrich.provenance)
		: [];
	const titleGuess = sug.title || enrich.title || item.subject || 'Untitled';
	const typeGuess = String(sug.type || 'essay');
	const slugGuess = String(titleGuess)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 80);
	const collected = String(item.collectedAt || '').slice(0, 10);
	const enrichStatus = String(enrich.status || '—');
	const enriching = enrichStatus === 'queued' || enrichStatus === 'running';

	const atts = (item.attachments || [])
		.map(
			(a, i) =>
				`<li>${escapeHtml(a.filename || a.key || i)}
        <span>(${escapeHtml(a.kind || '')}${a.stored ? '' : ', not stored'})</span>
        ${a.stored ? ` · <a href="/research/admin/api/attachment?key=${encodeURIComponent(a.key)}">download</a>` : ''}</li>`,
		)
		.join('');

	const pdfAtt = /** @type {{ key?: string, filename?: string, kind?: string, contentType?: string, stored?: boolean } | undefined} */ (
		(item.attachments || []).find(
			(a) =>
				a.stored &&
				a.key &&
				(a.kind === 'pdf' ||
					String(a.contentType || '').includes('pdf') ||
					String(a.filename || '').toLowerCase().endsWith('.pdf')),
		)
	);
	const pdfSrc = pdfAtt?.key
		? `/research/admin/api/attachment?key=${encodeURIComponent(String(pdfAtt.key))}`
		: '';
	const rawPdfText = String(enrich.pdfTextPreview || '');
	const pdfText = looksLikeRawPdfDump(rawPdfText) ? '' : rawPdfText;
	const pdfPreviewHtml = pdfSrc || pdfText
		? `<details open>
        <summary>PDF${pdfAtt?.filename ? ` · ${escapeHtml(String(pdfAtt.filename))}` : ''}</summary>
        ${pdfSrc ? `<iframe class="pdf-embed" src="${escapeHtml(pdfSrc)}" title="PDF preview"></iframe>` : ''}
        ${
					pdfText
						? `<pre class="block">${escapeHtml(pdfText)}</pre>`
						: pdfSrc
							? `<p class="field-hint">No readable text extracted yet. Re-enrich to retry text extraction (the file above is the original PDF).</p>`
							: ''
				}
      </details>`
		: '';

	const flash = opts.error
		? `<p class="flash err">${escapeHtml(opts.error)}</p>`
		: opts.flash
			? `<p class="flash">${escapeHtml(opts.flash)}</p>`
			: '';

	const types = ['book', 'essay', 'artwork', 'person', 'concept', 'place', 'archive', 'film', 'other'];
	const urlList = item.urls || [];
	const urlsHtml = urlList.length
		? urlList.map((u) => `<a href="${escapeHtml(u)}">${escapeHtml(u)}</a>`).join('<br/>')
		: '';

	const stages = /** @type {Record<string, Record<string, unknown>>} */ (enrich.stages || {});
	const stageKeys = Object.keys(stages);
	const stageChips = stageKeys.length
		? `<ul class="stage-chips" aria-label="Enrichment stages">${stageKeys
				.map((k) => {
					const s = stages[k] || {};
					const st = String(s.status || '');
					const tip = [s.reason, s.source, s.preview].filter(Boolean).join(' · ');
					return `<li data-status="${escapeHtml(st)}" title="${escapeHtml(tip)}">${escapeHtml(k)} · ${escapeHtml(st || '—')}</li>`;
				})
				.join('')}</ul>`
		: `<p class="research-summary">No stages yet.</p>`;
	const llmStage = stages.llm || {};
	const llmFailNote =
		llmStage.status === 'failed'
			? `<p class="enrich-note">LLM failed${llmStage.model ? ` via <code class="inline-code">${escapeHtml(String(llmStage.model))}</code>` : ''}${
					llmStage.reason ? ` (${escapeHtml(String(llmStage.reason))})` : ''
				}${
					llmStage.preview ? `: <code class="inline-code">${escapeHtml(String(llmStage.preview).slice(0, 160))}</code>` : ''
				}. Re-enrich, or fill promote fields manually.</p>`
			: '';

	const provBadges = provenance.length
		? `<p class="research-summary">${provenance
				.map(
					(p) =>
						`<span class="badge" title="confidence ${escapeHtml(String(p.confidence))}">${escapeHtml(String(p.field))}: ${escapeHtml(String(p.source))}</span>`,
				)
				.join(' ')}</p>`
		: '';

	const match = enrich.libraryMatch
		? `<p class="flash">Already in library as <a href="/research/admin/library/${escapeHtml(String(enrich.libraryMatch.slug))}">${escapeHtml(String(enrich.libraryMatch.title || enrich.libraryMatch.slug))}</a> — connect via collections/related instead of duplicating.</p>`
		: '';

	const graph = /** @type {Record<string, Array<{ slug: string, title?: string, score?: number }>>} */ (
		enrich.graph || {}
	);
	const graphHtml = ['research', 'works', 'writing']
		.map((kind) => {
			const list = graph[kind] || [];
			if (!list.length) return '';
			return `<p class="research-summary"><strong>${escapeHtml(kind)}</strong>: ${list
				.slice(0, 6)
				.map((g) => `${escapeHtml(g.slug)}${g.score != null ? ` (${g.score})` : ''}`)
				.join(', ')}</p>`;
		})
		.join('');

	const tagsVal = [
		...(Array.isArray(sug.tags) ? sug.tags : []),
		...(Array.isArray(sug.newTags) ? sug.newTags : []),
	].join(', ');
	const colsVal = Array.isArray(sug.collections) ? sug.collections.join(', ') : '';
	const relatedResearch = Array.isArray(sug.relatedResearch) ? sug.relatedResearch.join(', ') : '';
	const relatedWorks = Array.isArray(sug.relatedWorks) ? sug.relatedWorks.join(', ') : '';
	const relatedWriting = Array.isArray(sug.relatedWriting) ? sug.relatedWriting.join(', ') : '';
	const chicagoPreview =
		formatChicagoCitation({
			title: titleGuess,
			subtitle: sug.subtitle,
			type: typeGuess,
			by: sug.by,
			year: sug.year,
			publisher: sug.publisher,
			place: sug.place,
			doi: sug.doi,
			url: sug.url || item.primaryUrl || enrich.url,
			container: sug.container,
			volume: sug.volume,
			issue: sug.issue,
			pages: sug.pages,
		}) || '';

	const messagePanel = item.text
		? `<section class="admin-panel">
        <h3 class="admin-panel__title">Message</h3>
        <pre class="block">${escapeHtml(String(item.text))}</pre>
      </section>`
		: '';

	const urlsPanel = urlsHtml
		? `<section class="admin-panel">
        <h3 class="admin-panel__title">URLs</h3>
        <p class="research-summary">${urlsHtml}</p>
      </section>`
		: '';

	const attsPanel = atts
		? `<section class="admin-panel">
        <h3 class="admin-panel__title">Attachments</h3>
        <ul class="file-list">${atts}</ul>
      </section>`
		: '';

	const enrichNote = enriching
		? `<p class="enrich-note">Enrichment ${escapeHtml(enrichStatus)} — this page refreshes automatically.</p>`
		: '';

	const headExtra = enriching ? '<meta http-equiv="refresh" content="4"/>' : '';

	return layout({
		title: String(titleGuess),
		active: 'inbox',
		compactHeader: true,
		headExtra,
		body: `
${flash}
${match}
<div class="item-top">
  <p class="research-back"><a href="/research/admin/">&lt; Inbox</a></p>
  <p class="item-meta" aria-label="Item status">
    <span class="badge">${escapeHtml(String(item.status))}</span>
    <span class="${enrichBadgeClass(enrichStatus)}">${escapeHtml(enrichStatus)}</span>
    <span class="item-meta__sep">·</span>
    <span>${escapeHtml(String(item.from || ''))}</span>
    <span class="item-meta__sep">·</span>
    <span>${escapeHtml(collected)}</span>
  </p>
  <div class="item-title-row">
    <h2 class="detail-title">${escapeHtml(String(titleGuess))}</h2>
  </div>
  <div class="item-triage actions">
    <form method="post" action="/research/admin/api/status">
      <input type="hidden" name="id" value="${escapeHtml(String(item.id))}"/>
      <input type="hidden" name="status" value="deferred"/>
      <button class="btn btn--amber" type="submit">Defer</button>
    </form>
    <form method="post" action="/research/admin/api/status" onsubmit="return confirm('Discard this inbox item? It stays in R2 under Discarded.')">
      <input type="hidden" name="id" value="${escapeHtml(String(item.id))}"/>
      <input type="hidden" name="status" value="discarded"/>
      <button class="btn btn--danger" type="submit">Discard</button>
    </form>
    <form method="post" action="/research/admin/api/delete" onsubmit="return confirm('Permanently delete this item and all R2 files (email + attachments)? This cannot be undone.')">
      <input type="hidden" name="id" value="${escapeHtml(String(item.id))}"/>
      <button class="btn btn--danger" type="submit">Delete permanently</button>
    </form>
  </div>
</div>

<div class="admin-grid">
  <div class="admin-col admin-col--source">
    ${messagePanel}
    ${urlsPanel}
    ${attsPanel}

    <section class="admin-panel">
      <h3 class="admin-panel__title">Enrichment</h3>
      ${enrichNote}
      ${stageChips}
      ${llmFailNote}
      ${provBadges}
      ${graphHtml}
      ${enrich.readerExcerpt ? `<details><summary>Reader excerpt</summary><pre class="block">${escapeHtml(String(enrich.readerExcerpt))}</pre></details>` : ''}
      ${pdfPreviewHtml}
      <form class="stack" method="post" action="/research/admin/api/enrich">
        <input type="hidden" name="id" value="${escapeHtml(String(item.id))}"/>
        <input type="hidden" name="force" value="1"/>
        <label>URL to enrich
          <input name="primaryUrl" value="${escapeHtml(String(item.primaryUrl || enrich.url || ''))}"/>
          <span class="field-hint">Runs OG, bibliography, PDF text, AI suggestions, and graph hints again.</span>
        </label>
        <label class="option-card">
          <input type="checkbox" name="forceArchive" value="1"/>
          <span class="option-card__text">
            <span class="option-card__label">Also refresh Wayback archive</span>
            <span class="option-card__help">Requests a new Internet Archive snapshot. Off by default if one already exists (Wayback is slow and rate-limited).</span>
          </span>
        </label>
        <div class="enrich-actions">
          <button class="btn btn--secondary" type="submit">Re-enrich</button>
        </div>
      </form>
    </section>
  </div>

  <div class="admin-col admin-col--promote">
    <section class="admin-panel">
      <h3 class="admin-panel__title">Promote to library</h3>
      <form class="stack" method="post" action="/research/admin/api/promote" id="promote-form">
        <input type="hidden" name="id" value="${escapeHtml(String(item.id))}"/>
        <div class="promote-grid">
          <label class="span-2">Title
            <input name="title" required value="${escapeHtml(String(titleGuess))}"/>
            ${provHint(provenance, 'title')}
          </label>
          <label>Slug
            <input name="slug" required value="${escapeHtml(slugGuess)}" pattern="[a-z0-9\\-]+"/>
          </label>
          <label>Type
            <select name="type">
              ${types.map((t) => `<option value="${t}" ${t === typeGuess ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
            ${provHint(provenance, 'type')}
          </label>
          <label class="span-2">URL
            <input name="url" value="${escapeHtml(String(sug.url || item.primaryUrl || enrich.url || ''))}"/>
          </label>
          <label class="span-2">Subtitle (bibliographic)
            <input name="subtitle" value="${escapeHtml(String(sug.subtitle || ''))}"/>
          </label>
          <label>By
            <input name="by" value="${escapeHtml(String(sug.by || ''))}"/>
            ${provHint(provenance, 'by')}
          </label>
          <label>Year
            <input name="year" value="${escapeHtml(String(sug.year || ''))}"/>
            ${provHint(provenance, 'year')}
          </label>
          <label>Place
            <input name="place" value="${escapeHtml(String(sug.place || ''))}"/>
            ${provHint(provenance, 'place')}
          </label>
          <label>Publisher
            <input name="publisher" value="${escapeHtml(String(sug.publisher || ''))}"/>
            ${provHint(provenance, 'publisher')}
          </label>
          <label class="span-2">DOI
            <input name="doi" value="${escapeHtml(String(sug.doi || ''))}"/>
            ${provHint(provenance, 'doi')}
          </label>
          <label class="span-2">Container (journal / edited volume)
            <input name="container" value="${escapeHtml(String(sug.container || ''))}"/>
            ${provHint(provenance, 'container')}
          </label>
          <label>Volume
            <input name="volume" value="${escapeHtml(String(sug.volume || ''))}"/>
          </label>
          <label>Issue
            <input name="issue" value="${escapeHtml(String(sug.issue || ''))}"/>
          </label>
          <label class="span-2">Pages
            <input name="pages" value="${escapeHtml(String(sug.pages || ''))}"/>
          </label>
          <label>Status
            <select name="status">
              <option value="note" selected>note</option>
              <option value="developed">developed</option>
              <option value="core">core</option>
            </select>
          </label>
          <label>Collected
            <input name="collected" value="${escapeHtml(collected)}"/>
          </label>
          <label class="span-2">Tags
            <input name="tags" value="${escapeHtml(tagsVal)}"/>
            ${provHint(provenance, 'tags')}
          </label>
          <label class="span-2">Collections
            <input name="collections" value="${escapeHtml(colsVal)}"/>
            ${provHint(provenance, 'collections')}
          </label>
          <label class="span-2">Related research
            <input name="relatedResearch" value="${escapeHtml(relatedResearch)}"/>
          </label>
          <label class="span-2">Related works
            <input name="relatedWorks" value="${escapeHtml(relatedWorks)}"/>
          </label>
          <label class="span-2">Related writing
            <input name="relatedWriting" value="${escapeHtml(relatedWriting)}"/>
          </label>
          <label class="span-2">Summary
            <textarea name="summary">${escapeHtml(String(sug.summary || enrich.description || ''))}</textarea>
            ${provHint(provenance, 'summary')}
          </label>
          <label class="span-2">Quote
            <textarea name="quote">${escapeHtml(String(sug.quote || ''))}</textarea>
            ${provHint(provenance, 'quote')}
          </label>
          <p class="span-2 item-meta">Chicago (auto)${chicagoPreview ? `: <cite>${escapeHtml(chicagoPreview)}</cite>` : ' — fill by / title / publisher (or container) to generate'}</p>
          <label class="span-2">Citation override (optional — leave blank to auto-generate)
            <textarea name="citation" placeholder="Leave blank unless the auto Chicago string needs a hand fix"></textarea>
          </label>
          <label class="span-2">Archived URL
            <input name="archivedUrl" value="${escapeHtml(String(sug.archivedUrl || ''))}"/>
          </label>
          <label class="span-2">Body
            <textarea name="body"></textarea>
          </label>
        </div>
        <div class="promote-actions">
          <button class="btn btn--primary" type="submit">Add to Research</button>
        </div>
      </form>
    </section>
  </div>
</div>
`,
	});
}

/**
 * @param {Array<{ slug: string, title: string, type?: string }>} entries
 */
export function libraryListPage(entries) {
	const rows = entries.length
		? entries
				.map(
					(e) => `<li class="research-list__item">
          <a class="research-list__link" href="/research/admin/library/${escapeHtml(e.slug)}">
            <span class="research-list__title">${escapeHtml(e.title || e.slug)}</span>
            <span class="research-list__meta">
              <span>${escapeHtml(e.type || '')}</span>
              <span>${escapeHtml(e.slug)}</span>
            </span>
          </a>
        </li>`,
				)
				.join('')
		: `<p class="research__empty">No research files in the repo yet.</p>`;

	return layout({
		title: 'Library',
		active: 'library',
		body: `<ul class="research-list">${rows}</ul>`,
	});
}

/**
 * @param {{ slug: string, raw: string, data: Record<string, unknown>, body: string }} entry
 * @param {{ flash?: string, error?: string }} [opts]
 */
export function libraryEditPage(entry, opts = {}) {
	const flash = opts.error
		? `<p class="flash err">${escapeHtml(opts.error)}</p>`
		: opts.flash
			? `<p class="flash">${escapeHtml(opts.flash)}</p>`
			: '';
	const d = entry.data;
	const chicagoPreview = researchCitation(d) || '';
	return layout({
		title: String(d.title || entry.slug),
		active: 'library',
		compactHeader: true,
		body: `
${flash}
<div class="item-top">
<p class="research-back"><a href="/research/admin/library">&lt; Library</a></p>
<p class="item-meta">
  <span class="badge">${escapeHtml(String(d.type || ''))}</span>
  <span>${escapeHtml(entry.slug)}</span>
</p>
<div class="item-title-row">
<h2 class="detail-title">${escapeHtml(String(d.title || entry.slug))}</h2>
</div>
</div>
<section class="admin-panel" style="max-width:42rem;margin-top:var(--space-m)">
<form class="stack" method="post" action="/research/admin/api/library/${escapeHtml(entry.slug)}">
  <input type="hidden" name="_method" value="put"/>
  <div class="promote-grid">
    <label class="span-2">Title <input name="title" required value="${escapeHtml(String(d.title || ''))}"/></label>
    <label class="span-2">Subtitle <input name="subtitle" value="${escapeHtml(String(d.subtitle || ''))}"/></label>
    <label>Slug <input name="slug" required value="${escapeHtml(entry.slug)}" readonly/></label>
    <label>Type <input name="type" value="${escapeHtml(String(d.type || 'other'))}"/></label>
    <label class="span-2">URL <input name="url" value="${escapeHtml(String(d.url || ''))}"/></label>
    <label>By <input name="by" value="${escapeHtml(String(d.by || ''))}"/></label>
    <label>Year <input name="year" value="${escapeHtml(String(d.year || ''))}"/></label>
    <label>Place <input name="place" value="${escapeHtml(String(d.place || ''))}"/></label>
    <label>Publisher <input name="publisher" value="${escapeHtml(String(d.publisher || ''))}"/></label>
    <label class="span-2">DOI <input name="doi" value="${escapeHtml(String(d.doi || ''))}"/></label>
    <label class="span-2">Container <input name="container" value="${escapeHtml(String(d.container || ''))}"/></label>
    <label>Volume <input name="volume" value="${escapeHtml(String(d.volume || ''))}"/></label>
    <label>Issue <input name="issue" value="${escapeHtml(String(d.issue || ''))}"/></label>
    <label class="span-2">Pages <input name="pages" value="${escapeHtml(String(d.pages || ''))}"/></label>
    <label class="span-2">Status <input name="status" value="${escapeHtml(String(d.status || 'note'))}"/></label>
    <label class="span-2">Tags <input name="tags" value="${escapeHtml(Array.isArray(d.tags) ? d.tags.join(', ') : '')}"/></label>
    <label class="span-2">Collections <input name="collections" value="${escapeHtml(Array.isArray(d.collections) ? d.collections.join(', ') : '')}"/></label>
    <label class="span-2">Summary <textarea name="summary">${escapeHtml(String(d.summary || ''))}</textarea></label>
    <p class="span-2 item-meta">Chicago (display)${chicagoPreview ? `: <cite>${escapeHtml(chicagoPreview)}</cite>` : ''}</p>
    <label class="span-2">Citation override (optional)
      <textarea name="citation" placeholder="Leave blank to auto-generate">${escapeHtml(String(d.citation || ''))}</textarea>
    </label>
    <label class="span-2">Body <textarea name="body" style="min-height:10rem">${escapeHtml(entry.body)}</textarea></label>
    <label class="span-2">Raw override (optional — if set, saves this instead of form fields)
      <textarea name="raw" style="min-height:8rem" placeholder="Leave blank to use form"></textarea>
    </label>
  </div>
  <div class="promote-actions actions">
    <button class="btn btn--primary" type="submit">Save (commit)</button>
  </div>
</form>
</section>
<form method="post" action="/research/admin/api/library/${escapeHtml(entry.slug)}" onsubmit="return confirm('Delete ${escapeHtml(entry.slug)} from the repo?')" style="margin-top:var(--space-m)">
  <input type="hidden" name="_method" value="delete"/>
  <button class="btn btn--danger" type="submit">Delete from library</button>
</form>
`,
	});
}

/**
 * @param {string} html
 * @param {number} [status]
 */
export function html(html, status = 200) {
	return new Response(html, {
		status,
		headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
	});
}

/**
 * @param {unknown} data
 * @param {number} [status]
 */
export function json(data, status = 200) {
	return new Response(JSON.stringify(data, null, 2), {
		status,
		headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
	});
}
