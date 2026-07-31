import {
	CROSSREF_UA,
	LLM_MODEL,
	LLM_TIMEOUT_MS,
	MAX_ATTACHMENT_BYTES,
	PDF_MAX_CHARS,
	PDF_SCAN_BYTES,
	READER_MAX_CHARS,
	STAGE_TIMEOUT_MS,
} from './constants.js';
import {
	extractIds,
	extractPdfTextRough,
	filenameFromUrl,
	log,
	normalizeUrl,
	parseOpenGraph,
	readerExcerpt,
	safeFetch,
	sanitizeFilename,
	shouldStoreAsFile,
	withTimeout,
} from './fetch.js';
import {
	findLibraryByUrl,
	graphHints,
	loadAllIndexes,
	vocabFromLibrary,
} from './indexes.js';

/**
 * @typedef {object} EnrichEnv
 * @property {R2Bucket} RESEARCH
 * @property {Ai} [AI]
 */

/**
 * @typedef {object} EnrichOpts
 * @property {boolean} [force]
 * @property {boolean} [forceArchive]
 * @property {string} [primaryUrlOverride]
 * @property {number} [generation]
 */

/**
 * Full enrichment pipeline. Patches meta.json after each stage.
 * @param {EnrichEnv} env
 * @param {Record<string, unknown>} meta
 * @param {EnrichOpts} [opts]
 */
export async function runEnrichPipeline(env, meta, opts = {}) {
	const prefix = /** @type {string} */ (meta.prefix);
	const id = /** @type {string} */ (meta.id);
	const generation = opts.generation ?? (Number(meta.enrichment?.generation) || 0) + 1;

	const existing = /** @type {Record<string, unknown>} */ (meta.enrichment || {});
	if (!opts.force && existing.status === 'running') {
		log('enrich_skip', { id, reason: 'already_running' });
		return meta;
	}

	if (opts.primaryUrlOverride) {
		meta.primaryUrl = opts.primaryUrlOverride;
	}

	/** Soft URL duplicate: copy prior enrichment unless force */
	if (!opts.force && meta.duplicateUrlOf && existing.status !== 'ok' && existing.status !== 'partial') {
		const copied = await tryCopyDuplicateEnrichment(env, meta);
		if (copied) {
			await putMeta(env, prefix, meta);
			return meta;
		}
	}

	const primaryUrl = meta.primaryUrl ? String(meta.primaryUrl) : null;
	const attachments = /** @type {Array<Record<string, unknown>>} */ (meta.attachments || []);
	const hasPdf = attachments.some(
		(a) => a.stored && (a.kind === 'pdf' || String(a.contentType || '').includes('pdf')),
	);

	/** @type {Record<string, unknown>} */
	const enrichment = {
		status: 'running',
		generation,
		url: primaryUrl || undefined,
		stages: {},
		suggestions: {},
		provenance: [],
		fetchedAt: new Date().toISOString(),
	};
	meta.enrichment = enrichment;
	await putMeta(env, prefix, meta);
	log('enrich_stage', { id, stage: 'start', generation });

	let htmlBody = '';
	let pdfText = '';
	let stageFailures = 0;

	// --- OG / file ---
	if (primaryUrl) {
		try {
			await withTimeout(
				stageOgOrFile(env, meta, enrichment, primaryUrl, attachments),
				STAGE_TIMEOUT_MS,
				'timeout',
			);
			htmlBody = String(enrichment._html || '');
			delete enrichment._html;
		} catch (err) {
			stageFailures += 1;
			enrichment.stages.og = {
				status: 'failed',
				reason: err instanceof Error ? err.message : String(err),
			};
			log('enrich_stage', { id, stage: 'og', status: 'failed' });
		}
		await putMeta(env, prefix, meta);
	} else {
		enrichment.stages.og = { status: 'skipped', source: 'skipped', reason: 'no_url' };
	}

	// --- HTML reader ---
	if (htmlBody) {
		try {
			const excerpt = readerExcerpt(htmlBody, READER_MAX_CHARS);
			enrichment.readerExcerpt = excerpt;
			enrichment.stages.reader = { status: 'ok', chars: excerpt.length };
		} catch (err) {
			stageFailures += 1;
			enrichment.stages.reader = {
				status: 'failed',
				reason: err instanceof Error ? err.message : String(err),
			};
		}
		await putMeta(env, prefix, meta);
	} else {
		enrichment.stages.reader = { status: 'skipped', reason: 'no_html' };
	}

	// --- PDF text from stored attachments ---
	if (hasPdf || enrichment.stages.og?.source === 'file') {
		try {
			pdfText = await extractStoredPdfText(env, attachments);
			if (pdfText) {
				enrichment.pdfTextPreview = pdfText;
				enrichment.stages.pdf = { status: 'ok', chars: pdfText.length };
			} else {
				enrichment.stages.pdf = { status: 'skipped', reason: 'no_text' };
			}
		} catch (err) {
			stageFailures += 1;
			enrichment.stages.pdf = {
				status: 'failed',
				reason: err instanceof Error ? err.message : String(err),
			};
		}
		await putMeta(env, prefix, meta);
	} else {
		enrichment.stages.pdf = { status: 'skipped', reason: 'no_pdf' };
	}

	// --- DOI / ISBN ---
	const idSourceText = `${pdfText}\n${enrichment.readerExcerpt || ''}\n${enrichment.title || ''}`;
	const ids = extractIds(idSourceText, primaryUrl || '');
	enrichment.stages.ids = {
		status: ids.doi || ids.isbn ? 'ok' : 'skipped',
		doi: ids.doi,
		isbn: ids.isbn,
		source: ids.source,
	};
	await putMeta(env, prefix, meta);

	// --- Bibliographic ---
	if (ids.doi || ids.isbn || looksLikeWorkTitle(enrichment.title)) {
		try {
			await withTimeout(
				stageBib(enrichment, ids, enrichment.title),
				STAGE_TIMEOUT_MS,
				'timeout',
			);
		} catch (err) {
			stageFailures += 1;
			enrichment.stages.bib = {
				status: 'failed',
				reason: err instanceof Error ? err.message : String(err),
			};
		}
		await putMeta(env, prefix, meta);
	} else {
		enrichment.stages.bib = { status: 'skipped', source: 'none' };
	}

	// --- Wayback ---
	const priorArchive = enrichment.suggestions?.archivedUrl || existing.suggestions?.archivedUrl;
	if (primaryUrl && (!priorArchive || opts.forceArchive)) {
		try {
			await withTimeout(stageWayback(enrichment, primaryUrl), STAGE_TIMEOUT_MS, 'timeout');
		} catch (err) {
			stageFailures += 1;
			enrichment.stages.archive = {
				status: 'failed',
				reason: err instanceof Error ? err.message : String(err),
			};
		}
		await putMeta(env, prefix, meta);
	} else if (priorArchive) {
		enrichment.stages.archive = {
			status: 'ok',
			archivedUrl: priorArchive,
			reason: 'kept_existing',
		};
		enrichment.suggestions.archivedUrl = priorArchive;
	} else {
		enrichment.stages.archive = { status: 'skipped', reason: 'no_url' };
	}

	// --- Indexes + library match ---
	const indexes = await loadAllIndexes(env.RESEARCH);
	if (primaryUrl) {
		const match = findLibraryByUrl(indexes.library, primaryUrl);
		if (match) enrichment.libraryMatch = match;
	}

	// Seed suggestions from OG / bib before LLM
	seedSuggestions(enrichment, meta);
	const vocab = vocabFromLibrary(indexes.library);

	// --- LLM ---
	if (env.AI) {
		try {
			await withTimeout(
				stageLlm(env, meta, enrichment, indexes, vocab),
				LLM_TIMEOUT_MS,
				'timeout',
			);
		} catch (err) {
			stageFailures += 1;
			enrichment.stages.llm = {
				status: 'failed',
				reason: err instanceof Error ? err.message : String(err),
			};
			log('enrich_stage', { id, stage: 'llm', status: 'failed' });
		}
		await putMeta(env, prefix, meta);
	} else {
		enrichment.stages.llm = { status: 'skipped', reason: 'no_ai_binding' };
	}

	// --- Graph ---
	const sug = /** @type {Record<string, unknown>} */ (enrichment.suggestions);
	const graph = graphHints(
		{
			title: String(sug.title || enrichment.title || meta.subject || ''),
			tags: /** @type {string[]} */ (sug.tags || []),
			collections: /** @type {string[]} */ (sug.collections || []),
			by: String(sug.by || ''),
			summary: String(sug.summary || enrichment.description || ''),
		},
		indexes,
	);
	enrichment.graph = graph;
	enrichment.stages.graph = { status: 'ok' };

	// Merge graph slugs into suggestions if empty
	if (!sug.relatedResearch?.length && graph.research.length) {
		sug.relatedResearch = graph.research.slice(0, 5).map((x) => x.slug);
	}
	if (!sug.relatedWorks?.length && graph.works.length) {
		sug.relatedWorks = graph.works.slice(0, 4).map((x) => x.slug);
	}
	if (!sug.relatedWriting?.length && graph.writing.length) {
		sug.relatedWriting = graph.writing.slice(0, 4).map((x) => x.slug);
	}

	suggestQuote(meta, enrichment);

	enrichment.status = stageFailures > 0 ? 'partial' : 'ok';
	enrichment.fetchedAt = new Date().toISOString();
	meta.attachments = attachments;
	meta.enrichment = enrichment;
	await putMeta(env, prefix, meta);
	log('enrich_ok', { id, status: enrichment.status, generation });
	return meta;
}

/**
 * @param {EnrichEnv} env
 * @param {Record<string, unknown>} meta
 * @param {Record<string, unknown>} enrichment
 * @param {string} primaryUrl
 * @param {Array<Record<string, unknown>>} attachments
 */
async function stageOgOrFile(env, meta, enrichment, primaryUrl, attachments) {
	const prefix = /** @type {string} */ (meta.prefix);
	const result = await safeFetch(primaryUrl, { maxBytes: MAX_ATTACHMENT_BYTES });
	if (!result.ok) {
		enrichment.stages.og = { status: 'failed', reason: result.reason };
		return;
	}

	const contentType = result.response.headers.get('content-type') || '';
	enrichment.finalUrl = result.finalUrl;

	if (shouldStoreAsFile(result.finalUrl, contentType)) {
		const filename = filenameFromUrl(result.finalUrl, contentType);
		const index = attachments.length;
		const key = `${prefix}/attachments/${index}-${filename}`;
		const size = result.body.byteLength;
		if (size > MAX_ATTACHMENT_BYTES) {
			attachments.push({
				key,
				filename,
				contentType,
				size,
				kind: kindFromType(contentType),
				source: 'url',
				stored: false,
				reason: 'too_large',
				url: primaryUrl,
			});
			enrichment.title = filename;
			enrichment.stages.og = { status: 'ok', source: 'file', reason: 'too_large' };
		} else {
			await env.RESEARCH.put(key, result.body, {
				httpMetadata: {
					contentType: contentType.split(';')[0].trim() || 'application/octet-stream',
				},
			});
			attachments.push({
				key,
				filename,
				contentType,
				size,
				kind: kindFromType(contentType),
				source: 'url',
				stored: true,
				url: primaryUrl,
			});
			enrichment.title = filename;
			enrichment.storedFile = key;
			enrichment.stages.og = { status: 'ok', source: 'file' };
			addProv(enrichment, 'title', 'og', 0.5);
		}
		return;
	}

	const html = new TextDecoder('utf-8', { fatal: false }).decode(result.body);
	const og = parseOpenGraph(html);
	if (og.title) enrichment.title = og.title;
	if (og.description) enrichment.description = og.description;
	if (og.image) enrichment.image = og.image;
	enrichment._html = html;
	enrichment.stages.og = { status: 'ok', source: 'og' };
	if (og.title) addProv(enrichment, 'title', 'og', 0.7);
	if (og.description) addProv(enrichment, 'summary', 'og', 0.6);
}

/**
 * @param {EnrichEnv} env
 * @param {Array<Record<string, unknown>>} attachments
 */
async function extractStoredPdfText(env, attachments) {
	for (const a of attachments) {
		if (!a.stored || !a.key) continue;
		const isPdf =
			a.kind === 'pdf' ||
			String(a.contentType || '').includes('pdf') ||
			String(a.filename || '').toLowerCase().endsWith('.pdf');
		if (!isPdf) continue;
		const obj = await env.RESEARCH.get(String(a.key));
		if (!obj) continue;
		const buf = await obj.arrayBuffer();
		return extractPdfTextRough(buf, PDF_MAX_CHARS, PDF_SCAN_BYTES);
	}
	return '';
}

/**
 * @param {Record<string, unknown>} enrichment
 * @param {{ doi?: string, isbn?: string }} ids
 * @param {unknown} ogTitle
 */
async function stageBib(enrichment, ids, ogTitle) {
	if (ids.doi) {
		const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(ids.doi)}`, {
			headers: { 'User-Agent': CROSSREF_UA, Accept: 'application/json' },
		});
		if (res.ok) {
			const data = await res.json();
			const msg = data.message || {};
			applyCrossref(enrichment, msg);
			enrichment.stages.bib = { status: 'ok', source: 'crossref' };
			return;
		}
	}

	if (ids.isbn) {
		const res = await fetch(`https://openlibrary.org/isbn/${ids.isbn}.json`, {
			headers: { 'User-Agent': CROSSREF_UA, Accept: 'application/json' },
		});
		if (res.ok) {
			const data = await res.json();
			const sug = /** @type {Record<string, unknown>} */ (enrichment.suggestions);
			if (data.title) {
				sug.title = data.title;
				addProv(enrichment, 'title', 'openlibrary', 0.9);
			}
			if (data.publish_date) {
				const y = String(data.publish_date).match(/\d{4}/);
				if (y) {
					sug.year = y[0];
					addProv(enrichment, 'year', 'openlibrary', 0.85);
				}
			}
			sug.citation = [data.title, data.publish_date].filter(Boolean).join('. ');
			addProv(enrichment, 'citation', 'openlibrary', 0.8);
			enrichment.stages.bib = { status: 'ok', source: 'openlibrary' };
			return;
		}
	}

	if (looksLikeWorkTitle(ogTitle)) {
		const q = encodeURIComponent(String(ogTitle));
		const res = await fetch(`https://api.crossref.org/works?query.bibliographic=${q}&rows=1`, {
			headers: { 'User-Agent': CROSSREF_UA, Accept: 'application/json' },
		});
		if (res.ok) {
			const data = await res.json();
			const item = data.message?.items?.[0];
			if (item && titleSimilar(String(ogTitle), String(item.title?.[0] || ''))) {
				applyCrossref(enrichment, item);
				enrichment.stages.bib = { status: 'ok', source: 'crossref' };
				return;
			}
		}
	}

	enrichment.stages.bib = { status: 'skipped', source: 'none' };
}

/**
 * @param {Record<string, unknown>} enrichment
 * @param {Record<string, unknown>} msg
 */
function applyCrossref(enrichment, msg) {
	const sug = /** @type {Record<string, unknown>} */ (enrichment.suggestions);
	const title = Array.isArray(msg.title) ? msg.title[0] : msg.title;
	if (title) {
		sug.title = title;
		addProv(enrichment, 'title', 'crossref', 0.95);
	}
	const authors = Array.isArray(msg.author)
		? msg.author
				.map((a) => [a.given, a.family].filter(Boolean).join(' '))
				.filter(Boolean)
				.join(', ')
		: '';
	if (authors) {
		sug.by = authors;
		addProv(enrichment, 'by', 'crossref', 0.9);
	}
	const year =
		msg.published?.['date-parts']?.[0]?.[0] ||
		msg['published-print']?.['date-parts']?.[0]?.[0] ||
		msg['published-online']?.['date-parts']?.[0]?.[0];
	if (year) {
		sug.year = String(year);
		addProv(enrichment, 'year', 'crossref', 0.9);
	}
	if (msg.URL) sug.url = msg.URL;
	const container = Array.isArray(msg['container-title']) ? msg['container-title'][0] : '';
	sug.citation = [authors, title, container, year, msg.DOI ? `https://doi.org/${msg.DOI}` : '']
		.filter(Boolean)
		.join('. ');
	addProv(enrichment, 'citation', 'crossref', 0.9);
	if (!sug.type) {
		const ty = String(msg.type || '');
		if (ty.includes('book')) sug.type = 'book';
		else if (ty.includes('journal') || ty.includes('article')) sug.type = 'essay';
	}
}

/**
 * @param {Record<string, unknown>} enrichment
 * @param {string} url
 */
async function stageWayback(enrichment, url) {
	const res = await fetch(`https://web.archive.org/save/${url}`, {
		method: 'GET',
		redirect: 'manual',
		headers: { 'User-Agent': CROSSREF_UA },
	});
	const loc = res.headers.get('location') || res.headers.get('content-location');
	let archivedUrl = loc || undefined;
	if (!archivedUrl && res.url && res.url.includes('web.archive.org/web/')) {
		archivedUrl = res.url;
	}
	// SPN2 often returns 200 with Content-Location
	const cl = res.headers.get('content-location');
	if (cl && cl.includes('web.archive.org')) archivedUrl = new URL(cl, 'https://web.archive.org').toString();

	if (archivedUrl && archivedUrl.includes('web.archive.org')) {
		const sug = /** @type {Record<string, unknown>} */ (enrichment.suggestions);
		sug.archivedUrl = archivedUrl;
		sug.archivedAt = new Date().toISOString().slice(0, 10);
		enrichment.stages.archive = { status: 'ok', archivedUrl, archivedAt: sug.archivedAt };
		addProv(enrichment, 'archivedUrl', 'wayback', 0.8);
		return;
	}

	// availability API fallback
	const avail = await fetch(
		`https://archive.org/wayback/available?url=${encodeURIComponent(url)}`,
		{ headers: { 'User-Agent': CROSSREF_UA } },
	);
	if (avail.ok) {
		const data = await avail.json();
		const closest = data?.archived_snapshots?.closest;
		if (closest?.available && closest.url) {
			const sug = /** @type {Record<string, unknown>} */ (enrichment.suggestions);
			sug.archivedUrl = closest.url;
			sug.archivedAt = String(closest.timestamp || '').slice(0, 8);
			enrichment.stages.archive = { status: 'ok', archivedUrl: closest.url, reason: 'existing_snapshot' };
			return;
		}
	}

	enrichment.stages.archive = { status: 'failed', reason: `http_${res.status}` };
}

/**
 * @param {EnrichEnv} env
 * @param {Record<string, unknown>} meta
 * @param {Record<string, unknown>} enrichment
 * @param {{ library: any[], works: any[], writing: any[] }} indexes
 * @param {{ tags: string[], collections: string[] }} vocab
 */
async function stageLlm(env, meta, enrichment, indexes, vocab) {
	const sug = /** @type {Record<string, unknown>} */ (enrichment.suggestions);
	const prompt = `You curate an artist research library. Return ONLY valid JSON (no markdown) with keys:
title, by, year, type (one of: book,essay,artwork,person,concept,place,archive,film,other),
citation, summary (1-2 sentences), quote (optional short passage from body),
tags (string[] prefer existing), newTags (string[] only truly new),
collections (string[] prefer existing),
relatedResearch (slug[] from list), relatedWorks (slug[]), relatedWriting (slug[]).

Existing tags: ${JSON.stringify(vocab.tags.slice(0, 80))}
Existing collections: ${JSON.stringify(vocab.collections.slice(0, 40))}
Research slugs: ${JSON.stringify(indexes.library.slice(0, 40).map((e) => e.slug))}
Works slugs: ${JSON.stringify(indexes.works.slice(0, 30).map((e) => ({ slug: e.slug, title: e.title })))}
Writing slugs: ${JSON.stringify(indexes.writing.slice(0, 20).map((e) => ({ slug: e.slug, title: e.title })))}

Input:
subject: ${JSON.stringify(meta.subject || '')}
body: ${JSON.stringify(String(meta.text || '').slice(0, 1500))}
og_title: ${JSON.stringify(enrichment.title || '')}
og_description: ${JSON.stringify(enrichment.description || '')}
bib: ${JSON.stringify(sug)}
reader: ${JSON.stringify(String(enrichment.readerExcerpt || '').slice(0, 2000))}
pdf: ${JSON.stringify(String(enrichment.pdfTextPreview || '').slice(0, 2000))}
`;

	const result = await env.AI.run(LLM_MODEL, {
		messages: [
			{ role: 'system', content: 'Reply with JSON only.' },
			{ role: 'user', content: prompt },
		],
		max_tokens: 800,
	});

	const raw = typeof result === 'string' ? result : result.response || result.text || JSON.stringify(result);
	const parsed = parseJsonObject(String(raw));
	if (!parsed) {
		enrichment.stages.llm = { status: 'failed', reason: 'bad_json', model: LLM_MODEL };
		return;
	}

	mergeLlmSuggestions(enrichment, parsed);
	enrichment.stages.llm = { status: 'ok', model: LLM_MODEL };
}

/**
 * @param {Record<string, unknown>} enrichment
 * @param {Record<string, unknown>} parsed
 */
function mergeLlmSuggestions(enrichment, parsed) {
	const sug = /** @type {Record<string, unknown>} */ (enrichment.suggestions);
	const fields = ['title', 'by', 'year', 'type', 'citation', 'summary', 'quote'];
	for (const f of fields) {
		if (parsed[f] && !sug[f]) {
			sug[f] = parsed[f];
			addProv(enrichment, f, 'llm', 0.55);
		} else if (parsed[f] && f === 'summary' && !sug.summary) {
			sug.summary = parsed[f];
			addProv(enrichment, f, 'llm', 0.55);
		}
	}
	if (Array.isArray(parsed.tags)) {
		sug.tags = parsed.tags.map(String).slice(0, 12);
		addProv(enrichment, 'tags', 'llm', 0.5);
	}
	if (Array.isArray(parsed.newTags)) {
		sug.newTags = parsed.newTags.map(String).slice(0, 8);
	}
	if (Array.isArray(parsed.collections)) {
		sug.collections = parsed.collections.map(String).slice(0, 8);
		addProv(enrichment, 'collections', 'llm', 0.5);
	}
	if (Array.isArray(parsed.relatedResearch)) sug.relatedResearch = parsed.relatedResearch.map(String).slice(0, 8);
	if (Array.isArray(parsed.relatedWorks)) sug.relatedWorks = parsed.relatedWorks.map(String).slice(0, 6);
	if (Array.isArray(parsed.relatedWriting)) sug.relatedWriting = parsed.relatedWriting.map(String).slice(0, 6);
}

/**
 * @param {Record<string, unknown>} enrichment
 * @param {Record<string, unknown>} meta
 */
function seedSuggestions(enrichment, meta) {
	const sug = /** @type {Record<string, unknown>} */ (enrichment.suggestions);
	if (!sug.title) {
		if (enrichment.title) {
			sug.title = enrichment.title;
		} else if (meta.subject) {
			sug.title = meta.subject;
			addProv(enrichment, 'title', 'subject', 0.4);
		}
	}
	if (!sug.summary && enrichment.description) {
		sug.summary = enrichment.description;
	}
	if (!sug.url && meta.primaryUrl) sug.url = meta.primaryUrl;
}

/**
 * @param {Record<string, unknown>} meta
 * @param {Record<string, unknown>} enrichment
 */
function suggestQuote(meta, enrichment) {
	const sug = /** @type {Record<string, unknown>} */ (enrichment.suggestions);
	if (sug.quote) return;
	const text = String(meta.text || '');
	const quoted = text.match(/[“"]([^”"]{40,400})[”"]/);
	if (quoted) {
		sug.quote = quoted[1].trim();
		addProv(enrichment, 'quote', 'body', 0.7);
		return;
	}
	const lines = text.split(/\n+/).map((l) => l.trim()).filter((l) => l.length > 60 && l.length < 400);
	if (lines.length === 1 || (lines[0] && lines[0].startsWith('>'))) {
		sug.quote = lines[0].replace(/^>\s*/, '');
		addProv(enrichment, 'quote', 'body', 0.5);
	}
}

/**
 * @param {EnrichEnv} env
 * @param {Record<string, unknown>} meta
 */
async function tryCopyDuplicateEnrichment(env, meta) {
	const dupId = String(meta.duplicateUrlOf);
	// Find prior meta by listing is hard; use by-url pointer
	const primaryUrl = meta.primaryUrl ? normalizeUrl(String(meta.primaryUrl)) : null;
	if (!primaryUrl) return false;
	const hash = await sha256Hex(primaryUrl);
	const pointer = await env.RESEARCH.get(`inbox/by-url/${hash}.json`);
	if (!pointer) return false;
	try {
		const prev = await pointer.json();
		if (prev.id === meta.id) return false;
		const prevMetaObj = await env.RESEARCH.get(`${prev.prefix}/meta.json`);
		if (!prevMetaObj) return false;
		const prevMeta = await prevMetaObj.json();
		if (!prevMeta.enrichment || !['ok', 'partial'].includes(prevMeta.enrichment.status)) return false;
		meta.enrichment = {
			...prevMeta.enrichment,
			status: prevMeta.enrichment.status,
			reason: 'copied_duplicate',
			duplicateOf: dupId,
			generation: (Number(meta.enrichment?.generation) || 0) + 1,
		};
		log('enrich_ok', { id: meta.id, kind: 'copy_duplicate', from: dupId });
		return true;
	} catch {
		return false;
	}
}

/**
 * @param {Record<string, unknown>} enrichment
 * @param {string} field
 * @param {string} source
 * @param {number} confidence
 */
function addProv(enrichment, field, source, confidence) {
	const list = /** @type {Array<Record<string, unknown>>} */ (enrichment.provenance || []);
	const existing = list.find((p) => p.field === field);
	if (existing && Number(existing.confidence) >= confidence) return;
	const filtered = list.filter((p) => p.field !== field);
	filtered.push({ field, source, confidence });
	enrichment.provenance = filtered;
}

/** @param {unknown} title */
function looksLikeWorkTitle(title) {
	const t = String(title || '');
	if (t.length < 8 || t.length > 200) return false;
	if (/^(home|login|search|untitled)/i.test(t)) return false;
	return /[A-Za-z]/.test(t);
}

/** @param {string} a @param {string} b */
function titleSimilar(a, b) {
	const x = a.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
	const y = b.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
	if (!x || !y) return false;
	return x.includes(y.slice(0, 40)) || y.includes(x.slice(0, 40));
}

/** @param {string} raw */
function parseJsonObject(raw) {
	const start = raw.indexOf('{');
	const end = raw.lastIndexOf('}');
	if (start < 0 || end < 0) return null;
	try {
		return JSON.parse(raw.slice(start, end + 1));
	} catch {
		return null;
	}
}

/** @param {string} contentType */
function kindFromType(contentType) {
	const base = (contentType || '').split(';')[0].trim().toLowerCase();
	if (base === 'application/pdf') return 'pdf';
	if (base.startsWith('image/')) return 'image';
	return 'other';
}

/**
 * @param {EnrichEnv} env
 * @param {string} prefix
 * @param {Record<string, unknown>} meta
 */
async function putMeta(env, prefix, meta) {
	await env.RESEARCH.put(`${prefix}/meta.json`, JSON.stringify(meta, null, 2), {
		httpMetadata: { contentType: 'application/json' },
	});
}

/** @param {string} value */
async function sha256Hex(value) {
	const data = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest('SHA-256', data);
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export { normalizeUrl, sanitizeFilename };
