/**
 * Admin UI with site chrome (header + left-aligned sheet) matching /research (cv variant).
 * @param {{ title: string, body: string, active?: string }} opts
 */
export function layout(opts) {
	const active = opts.active || 'inbox';
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex"/>
<meta name="theme-color" content="#fafafa"/>
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
  --link: #f05f40;
  --hover: #e04a2c;
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
  --space-2xl: clamp(4rem, 3.7955rem + 0.9091vw, 4.5rem);
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
.page-header h1 {
  margin: 0 0 var(--space-2xs); font-family: var(--font-display); font-size: var(--type-display);
  font-weight: 500; font-optical-sizing: auto; letter-spacing: var(--tracking-display); line-height: var(--leading-display);
}
.research__lead {
  max-width: 38rem; margin: 0 0 var(--space-s);
  color: color-mix(in srgb, var(--text) 78%, var(--muted));
}
.admin-nav {
  display: flex; flex-wrap: wrap; gap: 0.65rem 1.35rem;
  font-size: var(--type-caption); letter-spacing: 0.01em;
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
.research-back { margin: 0 0 var(--space-m); font-size: var(--type-caption); }
.research-back a { color: var(--muted); }
.research-back a:is(:hover, :focus-visible) { color: var(--text); }
.research-kicker {
  display: flex; flex-wrap: wrap; gap: 0.5rem 1rem; margin: 0 0 var(--space-2xs);
  font-size: var(--type-caption); color: var(--muted); letter-spacing: 0.02em;
}
.research-section { margin: 0 0 var(--space-l); }
.research-section__heading {
  margin: 0 0 var(--space-2xs); font-size: var(--type-caption); font-weight: 500;
  letter-spacing: 0.02em; color: var(--muted);
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
  margin: 0 0 var(--space-xs); font-family: var(--font-display); font-size: var(--type-title);
  font-weight: 500; letter-spacing: var(--tracking-display); line-height: 1.15;
}
.actions { display: flex; flex-wrap: wrap; gap: var(--space-2xs); margin: 0 0 var(--space-l); }
button, .btn {
  font-family: var(--font-body); font-size: var(--type-caption); padding: 0.4rem 0.75rem;
  border: 1px solid color-mix(in srgb, var(--text) 18%, transparent); border-radius: 0;
  background: transparent; color: var(--text); cursor: pointer; display: inline-block;
  transition: color 0.35s var(--ease), background 0.35s var(--ease), border-color 0.35s var(--ease);
}
button:hover, .btn:hover { border-color: color-mix(in srgb, var(--text) 40%, transparent); }
button.primary, .btn.primary { background: var(--text); color: #fff; border-color: var(--text); }
form.stack {
  display: flex; flex-direction: column; gap: var(--space-s); margin: 0 0 var(--space-xl); max-width: 38rem;
}
label {
  display: flex; flex-direction: column; gap: 0.25rem; font-size: var(--type-caption);
  color: var(--muted); letter-spacing: 0.02em;
}
input, select, textarea {
  font-family: var(--font-body); font-size: var(--type-nav); color: var(--text); background: var(--bg);
  border: 1px solid color-mix(in srgb, var(--text) 18%, transparent); border-radius: 0; padding: 0.4rem 0.5rem;
}
textarea { min-height: 6rem; line-height: 1.5; }
.flash {
  padding: var(--space-2xs) var(--space-xs); margin: 0 0 var(--space-m);
  border: 1px solid color-mix(in srgb, var(--text) 12%, transparent); font-size: var(--type-caption); max-width: 38rem;
}
.flash.err { border-color: color-mix(in srgb, #a44 50%, var(--border)); }
pre.block {
  white-space: pre-wrap; font-family: var(--font-body); font-size: var(--type-caption); line-height: 1.45;
  max-width: 38rem; margin: 0 0 var(--space-m); padding: var(--space-xs);
  background: color-mix(in srgb, var(--text) 4%, var(--bg));
  color: color-mix(in srgb, var(--text) 82%, var(--muted));
}
.file-list { list-style: none; margin: 0 0 var(--space-m); padding: 0; font-size: var(--type-caption); color: var(--muted); }
.file-list li { margin: 0.35rem 0; }
.file-list a { color: var(--text); border-bottom: 1px solid color-mix(in srgb, var(--text) 22%, transparent); }
.promote-heading {
  margin: var(--space-xl) 0 var(--space-s); font-family: var(--font-display);
  font-size: var(--type-nav); font-weight: 500; letter-spacing: 0.02em;
}
.badge {
  display: inline-block; font-size: 0.75em; letter-spacing: 0.02em;
  padding: 0.1rem 0.35rem; border: 1px solid color-mix(in srgb, var(--text) 14%, transparent);
  color: var(--muted); margin-right: 0.25rem;
}
details { margin: 0.5rem 0; font-size: var(--type-caption); color: var(--muted); }
details summary { cursor: pointer; color: var(--text); }
@media (max-width: 40rem) {
  .site-header { padding: 1.25rem 1.25rem 1rem; }
  .main--cv { padding: 0 1.25rem 3rem; }
  .site-title__full { display: none; }
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
      <header class="page-header">
        <h1>Research</h1>
        <p class="research__lead">Admin — inbox triage and library. Not public.</p>
        <nav class="admin-nav" aria-label="Admin">
          <a href="/research/admin/" ${active === 'inbox' ? 'aria-current="page"' : ''}>Inbox</a>
          <a href="/research/admin/library" ${active === 'library' ? 'aria-current="page"' : ''}>Library</a>
        </nav>
      </header>
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
                <span class="badge">${escapeHtml(estatus)}</span>
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
<p class="research-summary" style="margin-bottom:1rem">
  <form method="post" action="/research/admin/api/indexes" style="display:inline">
    <button type="submit">Refresh site indexes</button>
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
	const titleGuess = sug.title || enrich.title || item.subject || 'Untitled';
	const typeGuess = String(sug.type || 'essay');
	const slugGuess = String(titleGuess)
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')
		.slice(0, 80);
	const collected = String(item.collectedAt || '').slice(0, 10);
	const atts = (item.attachments || [])
		.map(
			(a, i) =>
				`<li>${escapeHtml(a.filename || a.key || i)}
        <span>(${escapeHtml(a.kind || '')}${a.stored ? '' : ', not stored'})</span>
        ${a.stored ? ` · <a href="/research/admin/api/attachment?key=${encodeURIComponent(a.key)}">download</a>` : ''}</li>`,
		)
		.join('');

	const flash = opts.error
		? `<p class="flash err">${escapeHtml(opts.error)}</p>`
		: opts.flash
			? `<p class="flash">${escapeHtml(opts.flash)}</p>`
			: '';

	const types = ['book', 'essay', 'artwork', 'person', 'concept', 'place', 'archive', 'film', 'other'];
	const urls = (item.urls || [])
		.map((u) => `<a href="${escapeHtml(u)}">${escapeHtml(u)}</a>`)
		.join('<br/>');

	const stages = /** @type {Record<string, Record<string, unknown>>} */ (enrich.stages || {});
	const stageRows = Object.keys(stages)
		.map((k) => {
			const s = stages[k] || {};
			return `<li><strong>${escapeHtml(k)}</strong>: ${escapeHtml(String(s.status || ''))}${s.reason ? ` — ${escapeHtml(String(s.reason))}` : ''}${s.source ? ` (${escapeHtml(String(s.source))})` : ''}</li>`;
		})
		.join('');

	const prov = Array.isArray(enrich.provenance)
		? enrich.provenance
				.map(
					(p) =>
						`<span class="badge" title="confidence ${escapeHtml(String(p.confidence))}">${escapeHtml(String(p.field))}: ${escapeHtml(String(p.source))}</span>`,
				)
				.join(' ')
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

	const tagsVal = [...(Array.isArray(sug.tags) ? sug.tags : []), ...(Array.isArray(sug.newTags) ? sug.newTags : [])].join(
		', ',
	);
	const colsVal = Array.isArray(sug.collections) ? sug.collections.join(', ') : '';
	const relatedResearch = Array.isArray(sug.relatedResearch) ? sug.relatedResearch.join(', ') : '';
	const relatedWorks = Array.isArray(sug.relatedWorks) ? sug.relatedWorks.join(', ') : '';
	const relatedWriting = Array.isArray(sug.relatedWriting) ? sug.relatedWriting.join(', ') : '';

	return layout({
		title: String(titleGuess),
		active: 'inbox',
		body: `
${flash}
${match}
<p class="research-back"><a href="/research/admin/">Inbox</a></p>
<p class="research-kicker">
  <span>${escapeHtml(String(item.status))}</span>
  <span class="badge">${escapeHtml(String(enrich.status || '—'))}</span>
  <span>${escapeHtml(String(item.from || ''))}</span>
  <span>${escapeHtml(collected)}</span>
</p>
<h2 class="detail-title">${escapeHtml(String(titleGuess))}</h2>
${item.text ? `<pre class="block">${escapeHtml(String(item.text))}</pre>` : ''}
${urls ? `<section class="research-section"><h3 class="research-section__heading">URLs</h3><p class="research-summary">${urls}</p></section>` : ''}
${atts ? `<section class="research-section"><h3 class="research-section__heading">Attachments</h3><ul class="file-list">${atts}</ul></section>` : ''}

<section class="research-section">
  <h3 class="research-section__heading">Enrichment</h3>
  <ul class="file-list">${stageRows || '<li>No stages yet</li>'}</ul>
  ${prov ? `<p class="research-summary">${prov}</p>` : ''}
  ${graphHtml}
  ${enrich.readerExcerpt ? `<details><summary>Reader excerpt</summary><pre class="block">${escapeHtml(String(enrich.readerExcerpt))}</pre></details>` : ''}
  ${enrich.pdfTextPreview ? `<details><summary>PDF preview</summary><pre class="block">${escapeHtml(String(enrich.pdfTextPreview))}</pre></details>` : ''}
  <form class="stack" method="post" action="/research/admin/api/enrich" style="margin-top:1rem">
    <input type="hidden" name="id" value="${escapeHtml(String(item.id))}"/>
    <label>Primary URL override <input name="primaryUrl" value="${escapeHtml(String(item.primaryUrl || enrich.url || ''))}"/></label>
    <label><input type="checkbox" name="force" value="1"/> Force re-enrich</label>
    <label><input type="checkbox" name="forceArchive" value="1"/> Force Wayback again</label>
    <button type="submit">Re-enrich</button>
  </form>
</section>

<div class="actions">
  <form method="post" action="/research/admin/api/status">
    <input type="hidden" name="id" value="${escapeHtml(String(item.id))}"/>
    <input type="hidden" name="status" value="deferred"/>
    <button type="submit">Defer</button>
  </form>
  <form method="post" action="/research/admin/api/status">
    <input type="hidden" name="id" value="${escapeHtml(String(item.id))}"/>
    <input type="hidden" name="status" value="discarded"/>
    <button type="submit">Discard</button>
  </form>
</div>

<h3 class="promote-heading">Promote to library</h3>
<form class="stack" method="post" action="/research/admin/api/promote" id="promote-form">
  <input type="hidden" name="id" value="${escapeHtml(String(item.id))}"/>
  <label>Title <input name="title" required value="${escapeHtml(String(titleGuess))}"/></label>
  <label>Slug <input name="slug" required value="${escapeHtml(slugGuess)}" pattern="[a-z0-9\\-]+"/></label>
  <label>Type
    <select name="type">
      ${types.map((t) => `<option value="${t}" ${t === typeGuess ? 'selected' : ''}>${t}</option>`).join('')}
    </select>
  </label>
  <label>URL <input name="url" value="${escapeHtml(String(sug.url || item.primaryUrl || enrich.url || ''))}"/></label>
  <label>By <input name="by" value="${escapeHtml(String(sug.by || ''))}"/></label>
  <label>Year <input name="year" value="${escapeHtml(String(sug.year || ''))}"/></label>
  <label>Status
    <select name="status">
      <option value="note" selected>note</option>
      <option value="developed">developed</option>
      <option value="core">core</option>
    </select>
  </label>
  <label>Tags (comma-separated) <input name="tags" value="${escapeHtml(tagsVal)}"/></label>
  <label>Collections (comma-separated) <input name="collections" value="${escapeHtml(colsVal)}"/></label>
  <label>Related research <input name="relatedResearch" value="${escapeHtml(relatedResearch)}"/></label>
  <label>Related works <input name="relatedWorks" value="${escapeHtml(relatedWorks)}"/></label>
  <label>Related writing <input name="relatedWriting" value="${escapeHtml(relatedWriting)}"/></label>
  <label>Summary <textarea name="summary">${escapeHtml(String(sug.summary || enrich.description || ''))}</textarea></label>
  <label>Quote <textarea name="quote">${escapeHtml(String(sug.quote || ''))}</textarea></label>
  <label>Citation <textarea name="citation">${escapeHtml(String(sug.citation || ''))}</textarea></label>
  <label>Archived URL <input name="archivedUrl" value="${escapeHtml(String(sug.archivedUrl || ''))}"/></label>
  <label>Body <textarea name="body"></textarea></label>
  <label>Collected <input name="collected" value="${escapeHtml(collected)}"/></label>
  <button class="primary" type="submit">Promote (commit to main)</button>
</form>
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
	return layout({
		title: String(d.title || entry.slug),
		active: 'library',
		body: `
${flash}
<p class="research-back"><a href="/research/admin/library">Library</a></p>
<p class="research-kicker"><span>${escapeHtml(String(d.type || ''))}</span><span>${escapeHtml(entry.slug)}</span></p>
<h2 class="detail-title">${escapeHtml(String(d.title || entry.slug))}</h2>
<form class="stack" method="post" action="/research/admin/api/library/${escapeHtml(entry.slug)}">
  <input type="hidden" name="_method" value="put"/>
  <label>Title <input name="title" required value="${escapeHtml(String(d.title || ''))}"/></label>
  <label>Slug <input name="slug" required value="${escapeHtml(entry.slug)}" readonly/></label>
  <label>Type <input name="type" value="${escapeHtml(String(d.type || 'other'))}"/></label>
  <label>URL <input name="url" value="${escapeHtml(String(d.url || ''))}"/></label>
  <label>By <input name="by" value="${escapeHtml(String(d.by || ''))}"/></label>
  <label>Year <input name="year" value="${escapeHtml(String(d.year || ''))}"/></label>
  <label>Status <input name="status" value="${escapeHtml(String(d.status || 'note'))}"/></label>
  <label>Tags <input name="tags" value="${escapeHtml(Array.isArray(d.tags) ? d.tags.join(', ') : '')}"/></label>
  <label>Collections <input name="collections" value="${escapeHtml(Array.isArray(d.collections) ? d.collections.join(', ') : '')}"/></label>
  <label>Summary <textarea name="summary">${escapeHtml(String(d.summary || ''))}</textarea></label>
  <label>Citation <textarea name="citation">${escapeHtml(String(d.citation || ''))}</textarea></label>
  <label>Body <textarea name="body" style="min-height:10rem">${escapeHtml(entry.body)}</textarea></label>
  <label>Raw override (optional — if set, saves this instead of form fields)
    <textarea name="raw" style="min-height:8rem" placeholder="Leave blank to use form"></textarea>
  </label>
  <div class="actions">
    <button class="primary" type="submit">Save (commit)</button>
  </div>
</form>
<form method="post" action="/research/admin/api/library/${escapeHtml(entry.slug)}" onsubmit="return confirm('Delete ${escapeHtml(entry.slug)} from the repo?')">
  <input type="hidden" name="_method" value="delete"/>
  <button type="submit">Delete from library</button>
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
