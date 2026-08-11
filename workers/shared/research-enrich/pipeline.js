import { formatChicagoCitation } from '../chicago.js';
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
	seedFromAttachmentHints(enrichment, meta);
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
				model: LLM_MODEL,
			};
			log('enrich_stage', {
				id,
				stage: 'llm',
				status: 'failed',
				model: LLM_MODEL,
				error: err instanceof Error ? err.message : String(err),
			});
		}
		// Fill gaps even when LLM fails / returns sparse JSON
		seedFromAttachmentHints(enrichment, meta);
		await putMeta(env, prefix, meta);
	} else {
		enrichment.stages.llm = { status: 'skipped', reason: 'no_ai_binding' };
		seedFromAttachmentHints(enrichment, meta);
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
		return await extractPdfTextRough(buf, PDF_MAX_CHARS, PDF_SCAN_BYTES);
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
			const pubs = Array.isArray(data.publishers) ? data.publishers : [];
			if (pubs[0]) {
				sug.publisher = String(pubs[0]);
				addProv(enrichment, 'publisher', 'openlibrary', 0.85);
			}
			const places = Array.isArray(data.publish_places) ? data.publish_places : [];
			if (places[0]) {
				sug.place = String(places[0]);
				addProv(enrichment, 'place', 'openlibrary', 0.8);
			}
			if (ids.isbn) sug.ref = `isbn:${ids.isbn}`;
			if (!sug.type) sug.type = 'book';
			const generated = formatChicagoFromSug(sug);
			if (generated) {
				sug.citation = generated;
				addProv(enrichment, 'citation', 'openlibrary', 0.8);
			}
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
				.join(' and ')
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
	if (msg.DOI) {
		sug.doi = String(msg.DOI);
		addProv(enrichment, 'doi', 'crossref', 0.95);
	}
	if (msg.publisher) {
		sug.publisher = String(msg.publisher);
		addProv(enrichment, 'publisher', 'crossref', 0.9);
	}
	if (msg['publisher-location']) {
		sug.place = String(msg['publisher-location']);
		addProv(enrichment, 'place', 'crossref', 0.85);
	}
	const container = Array.isArray(msg['container-title']) ? msg['container-title'][0] : '';
	if (container) {
		sug.container = container;
		addProv(enrichment, 'container', 'crossref', 0.9);
	}
	if (msg.volume) {
		sug.volume = String(msg.volume);
		addProv(enrichment, 'volume', 'crossref', 0.9);
	}
	if (msg.issue) {
		sug.issue = String(msg.issue);
		addProv(enrichment, 'issue', 'crossref', 0.9);
	}
	if (msg.page) {
		sug.pages = String(msg.page).replace(/-/, '–');
		addProv(enrichment, 'pages', 'crossref', 0.9);
	}
	if (!sug.type) {
		const ty = String(msg.type || '');
		if (ty.includes('book')) sug.type = 'book';
		else if (ty.includes('journal') || ty.includes('article')) sug.type = 'essay';
	}
	const generated = formatChicagoFromSug(sug);
	if (generated) {
		sug.citation = generated;
		addProv(enrichment, 'citation', 'crossref', 0.9);
	}
}

/**
 * @param {Record<string, unknown>} sug
 * @returns {string | undefined}
 */
function formatChicagoFromSug(sug) {
	return formatChicagoCitation({
		title: sug.title,
		subtitle: sug.subtitle,
		type: sug.type,
		by: sug.by,
		year: sug.year,
		publisher: sug.publisher,
		place: sug.place,
		doi: sug.doi,
		url: sug.url,
		container: sug.container,
		volume: sug.volume,
		issue: sug.issue,
		pages: sug.pages,
	});
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
	const pdfText = String(enrichment.pdfTextPreview || '').slice(0, 2500);
	const filename =
		/** @type {Array<Record<string, unknown>>} */ (meta.attachments || []).find(
			(a) =>
				a.stored &&
				(a.kind === 'pdf' ||
					String(a.contentType || '').includes('pdf') ||
					String(a.filename || '')
						.toLowerCase()
						.endsWith('.pdf')),
		)?.filename || '';

	const prompt = buildLlmPrompt({
		meta,
		enrichment,
		sug,
		vocab,
		indexes,
		pdfText,
		filename: String(filename || ''),
		compact: false,
	});

	let raw = await runLlmRaw(env, prompt);
	let parsed = coerceSuggestionObject(parseJsonObject(raw));
	if (!parsed) {
		raw = await runLlmRaw(
			env,
			buildLlmPrompt({
				meta,
				enrichment,
				sug,
				vocab,
				indexes,
				pdfText,
				filename: String(filename || ''),
				compact: true,
			}),
		);
		parsed = coerceSuggestionObject(parseJsonObject(raw));
	}
	if (!parsed) {
		enrichment.stages.llm = {
			status: 'failed',
			reason: 'bad_json',
			model: LLM_MODEL,
			preview: String(raw || '').slice(0, 240),
		};
		return;
	}

	mergeLlmSuggestions(enrichment, parsed);
	seedFromAttachmentHints(enrichment, meta);
	enrichment.stages.llm = { status: 'ok', model: LLM_MODEL };
}

/**
 * @param {EnrichEnv} env
 * @param {string} prompt
 */
async function runLlmRaw(env, prompt) {
	let result;
	try {
		result = await env.AI.run(LLM_MODEL, {
			messages: [
				{
					role: 'system',
					content:
						'You are a JSON API. Respond with a single JSON object only. No markdown fences, no commentary, no thinking tags.',
				},
				{ role: 'user', content: prompt },
			],
			max_tokens: 1200,
			response_format: { type: 'json_object' },
		});
	} catch (err) {
		// Some models reject response_format — retry without it.
		const msg = err instanceof Error ? err.message : String(err);
		if (/response_format|json_object|unsupported/i.test(msg)) {
			try {
				result = await env.AI.run(LLM_MODEL, {
					messages: [
						{
							role: 'system',
							content:
								'You are a JSON API. Respond with a single JSON object only. No markdown fences, no commentary.',
						},
						{ role: 'user', content: prompt },
					],
					max_tokens: 1200,
				});
			} catch (err2) {
				const msg2 = err2 instanceof Error ? err2.message : String(err2);
				throw new Error(`${LLM_MODEL}: ${msg2}`);
			}
		} else {
			throw new Error(`${LLM_MODEL}: ${msg}`);
		}
	}
	return extractLlmText(result);
}

/**
 * Normalize Workers AI / OpenAI-compatible chat results to plain text.
 * @param {unknown} result
 */
function extractLlmText(result) {
	if (typeof result === 'string') return stripReasoning(result);
	if (!result || typeof result !== 'object') return '';
	const obj = /** @type {Record<string, unknown>} */ (result);

	if (typeof obj.response === 'string') return stripReasoning(obj.response);
	if (typeof obj.text === 'string') return stripReasoning(obj.text);

	const choice = Array.isArray(obj.choices) ? obj.choices[0] : null;
	const choiceMsg = choice && typeof choice === 'object' ? /** @type {Record<string, unknown>} */ (choice).message : null;
	const msg =
		(choiceMsg && typeof choiceMsg === 'object' ? choiceMsg : null) ||
		(obj.message && typeof obj.message === 'object' ? /** @type {Record<string, unknown>} */ (obj.message) : null);

	if (msg) {
		const content = msg.content;
		if (typeof content === 'string' && content.trim()) return stripReasoning(content);
		if (Array.isArray(content)) {
			const joined = content
				.map((p) => {
					if (typeof p === 'string') return p;
					if (p && typeof p === 'object') {
						const part = /** @type {Record<string, unknown>} */ (p);
						return String(part.text || part.content || '');
					}
					return '';
				})
				.join('');
			if (joined.trim()) return stripReasoning(joined);
		}
	}

	// Already a suggestion object (structured output)
	if (coerceSuggestionObject(obj)) return JSON.stringify(obj);

	if (typeof obj.result === 'string') return stripReasoning(obj.result);
	if (obj.result && typeof obj.result === 'object') {
		const nested = coerceSuggestionObject(/** @type {Record<string, unknown>} */ (obj.result));
		if (nested) return JSON.stringify(nested);
	}
	return '';
}

/** @param {string} text */
function stripReasoning(text) {
	return String(text || '')
		.replace(/<think>[\s\S]*?<\/think>/gi, '')
		.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, '')
		.trim();
}

/**
 * Accept direct suggestion objects; reject chat-completion envelopes.
 * @param {Record<string, unknown> | null} parsed
 */
function coerceSuggestionObject(parsed) {
	if (!parsed || typeof parsed !== 'object') return null;
	if (Array.isArray(parsed.choices) || parsed.object === 'chat.completion') return null;

	const nestedKeys = ['data', 'result', 'entry', 'suggestions', 'item'];
	for (const k of nestedKeys) {
		const inner = parsed[k];
		if (inner && typeof inner === 'object' && !Array.isArray(inner) && looksLikeSuggestions(/** @type {Record<string, unknown>} */ (inner))) {
			return /** @type {Record<string, unknown>} */ (inner);
		}
	}
	return looksLikeSuggestions(parsed) ? parsed : null;
}

/** @param {Record<string, unknown>} obj */
function looksLikeSuggestions(obj) {
	const keys = ['title', 'by', 'year', 'type', 'summary', 'tags', 'publisher', 'container', 'quote', 'doi'];
	return keys.some((k) => {
		const v = obj[k];
		if (Array.isArray(v)) return v.length > 0;
		return v != null && String(v).trim() !== '';
	});
}

/**
 * @param {{
 *   meta: Record<string, unknown>,
 *   enrichment: Record<string, unknown>,
 *   sug: Record<string, unknown>,
 *   vocab: { tags: string[], collections: string[] },
 *   indexes: { library: any[], works: any[], writing: any[] },
 *   pdfText: string,
 *   filename: string,
 *   compact: boolean,
 * }} p
 */
function buildLlmPrompt(p) {
	const tagN = p.compact ? 30 : 60;
	const colN = p.compact ? 15 : 30;
	const libN = p.compact ? 15 : 25;
	const workN = p.compact ? 10 : 15;
	const writeN = p.compact ? 8 : 12;
	const pdfN = p.compact ? 1600 : 2500;

	return `Curate one research-library entry. Return ONLY a JSON object with keys:
title, by, year, type (book|essay|artwork|person|concept|place|archive|film|other),
publisher, place, doi, subtitle, container, volume, issue, pages,
summary (1-2 original sentences — do NOT paste the PDF opening lines or page numbers),
quote (optional short passage from the body),
tags (string[]), newTags (string[]), collections (string[]),
relatedResearch (slug[]), relatedWorks (slug[]), relatedWriting (slug[]).
Rules:
- Prefer filename hints for author/title when clear (e.g. "Hito Steyerl_ Common Sensing _ NLR 144").
- NLR / New Left Review pieces are type "essay" with container "New Left Review"; do not invent a book publisher.
- doi only if a real DOI (10.xxxx/...), never a slug.
- Omit unknown fields or use "".
Prefer existing tags/collections/slugs when relevant.

Existing tags: ${JSON.stringify(p.vocab.tags.slice(0, tagN))}
Existing collections: ${JSON.stringify(p.vocab.collections.slice(0, colN))}
Research slugs: ${JSON.stringify(p.indexes.library.slice(0, libN).map((e) => e.slug))}
Works: ${JSON.stringify(p.indexes.works.slice(0, workN).map((e) => ({ slug: e.slug, title: e.title })))}
Writing: ${JSON.stringify(p.indexes.writing.slice(0, writeN).map((e) => ({ slug: e.slug, title: e.title })))}

Input:
filename: ${JSON.stringify(p.filename)}
subject: ${JSON.stringify(p.meta.subject || '')}
body: ${JSON.stringify(String(p.meta.text || '').slice(0, p.compact ? 800 : 1200))}
og_title: ${JSON.stringify(p.enrichment.title || '')}
og_description: ${JSON.stringify(String(p.enrichment.description || '').slice(0, 500))}
bib: ${JSON.stringify(p.sug)}
reader: ${JSON.stringify(String(p.enrichment.readerExcerpt || '').slice(0, p.compact ? 1000 : 1500))}
pdf: ${JSON.stringify(p.pdfText.slice(0, pdfN))}
`;
}

/**
 * @param {Record<string, unknown>} enrichment
 * @param {Record<string, unknown>} parsed
 */
function mergeLlmSuggestions(enrichment, parsed) {
	const sug = /** @type {Record<string, unknown>} */ (enrichment.suggestions);
	const provenance = Array.isArray(enrichment.provenance)
		? /** @type {Array<{ field?: string, source?: string, confidence?: number }>} */ (enrichment.provenance)
		: [];
	const fields = [
		'title',
		'by',
		'year',
		'type',
		'publisher',
		'place',
		'doi',
		'subtitle',
		'container',
		'volume',
		'issue',
		'pages',
		'summary',
		'quote',
	];
	const pdf = String(enrichment.pdfTextPreview || '');
	for (const f of fields) {
		const next = parsed[f];
		if (next == null || String(next).trim() === '') continue;
		if (f === 'title' && !isCleanTitle(String(next))) continue;
		if (f === 'summary' && isPdfDumpSummary(String(next), pdf)) continue;
		if (f === 'doi' && !/^10\.\d{4,9}\/\S+$/i.test(String(next).trim())) continue;
		const prior = provenance.find((p) => p.field === f);
		const weak =
			!sug[f] ||
			(prior &&
				(prior.source === 'filename' || prior.source === 'subject' || prior.source === 'pdf' || prior.source === 'default') &&
				(prior.confidence || 0) <= 0.55);
		// Filename author/title/container are trusted over weak LLM guesses
		if (prior && prior.source === 'filename' && (f === 'by' || f === 'container' || f === 'issue') && (prior.confidence || 0) >= 0.45) {
			continue;
		}
		if (weak) {
			sug[f] = typeof next === 'string' ? next.trim() : next;
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
		} else if (meta.subject && String(meta.subject).trim()) {
			sug.title = meta.subject;
			addProv(enrichment, 'title', 'subject', 0.4);
		} else {
			const pdfName = /** @type {Array<Record<string, unknown>>} */ (meta.attachments || []).find(
				(a) =>
					a.stored &&
					(a.kind === 'pdf' ||
						String(a.contentType || '').includes('pdf') ||
						String(a.filename || '')
							.toLowerCase()
							.endsWith('.pdf')),
			)?.filename;
			const fromFile = titleFromFilename(String(pdfName || ''));
			if (fromFile) {
				sug.title = fromFile;
				addProv(enrichment, 'title', 'filename', 0.45);
			}
		}
	}
	if (!sug.summary && enrichment.description) {
		sug.summary = enrichment.description;
	}
	if (!sug.url && meta.primaryUrl) sug.url = meta.primaryUrl;
}

/** @param {string} filename */
function titleFromFilename(filename) {
	const parts = splitFilenameParts(filename);
	return (parts.title || parts.raw || '').slice(0, 160);
}

/**
 * Conservative heuristics from PDF filename (+ light PDF checks).
 * Never dump raw PDF head into title/summary — that produced "Common Sensing? O".
 * @param {Record<string, unknown>} enrichment
 * @param {Record<string, unknown>} meta
 */
function seedFromAttachmentHints(enrichment, meta) {
	const sug = /** @type {Record<string, unknown>} */ (enrichment.suggestions || {});
	enrichment.suggestions = sug;
	const pdfName = String(
		/** @type {Array<Record<string, unknown>>} */ (meta.attachments || []).find(
			(a) =>
				a.stored &&
				(a.kind === 'pdf' ||
					String(a.contentType || '').includes('pdf') ||
					String(a.filename || '')
						.toLowerCase()
						.endsWith('.pdf')),
		)?.filename || '',
	);
	const parts = splitFilenameParts(pdfName);
	const pdf = String(enrichment.pdfTextPreview || '');

	// Structured filenames beat noisy email subjects / broken PDF caps.
	if (parts.title && isCleanTitle(parts.title)) {
		const prior = provFor(enrichment, 'title');
		const replace =
			!sug.title ||
			!isCleanTitle(String(sug.title)) ||
			prior?.source === 'subject' ||
			prior?.source === 'pdf' ||
			(prior?.source === 'filename' && String(sug.title).length > parts.title.length + 10);
		if (replace) {
			sug.title = parts.title;
			addProv(enrichment, 'title', 'filename', 0.55);
		}
	}
	if (!sug.by && parts.by) {
		sug.by = parts.by;
		addProv(enrichment, 'by', 'filename', 0.5);
	}
	if (!sug.year && parts.year) {
		sug.year = parts.year;
		addProv(enrichment, 'year', 'filename', 0.45);
	} else if (!sug.year) {
		const y = parts.raw.match(/\b(19|20)\d{2}\b/);
		if (y) {
			sug.year = y[0];
			addProv(enrichment, 'year', 'filename', 0.4);
		}
	}
	if (!sug.container && parts.container) {
		sug.container = parts.container;
		addProv(enrichment, 'container', 'filename', 0.5);
	} else if (!sug.container && (/\bNLR\b/i.test(parts.raw) || /\bNew Left Review\b/i.test(pdf))) {
		sug.container = 'New Left Review';
		addProv(enrichment, 'container', 'filename', 0.45);
	}
	if (!sug.issue && parts.issue) {
		sug.issue = parts.issue;
		addProv(enrichment, 'issue', 'filename', 0.45);
	} else if (!sug.issue) {
		const issue = parts.raw.match(/\bNLR\s*(\d+)\b/i);
		if (issue) sug.issue = issue[1];
	}
	if (!sug.type) {
		sug.type = parts.container || /\bNLR\b/i.test(parts.raw) ? 'essay' : 'essay';
		addProv(enrichment, 'type', 'default', 0.3);
	}
	if (!sug.subtitle && parts.subtitle) {
		sug.subtitle = parts.subtitle;
		addProv(enrichment, 'subtitle', 'filename', 0.4);
	}

	sanitizeSuggestions(enrichment, meta);
}

/**
 * Drop invented / garbage LLM+heuristic values before promote.
 * @param {Record<string, unknown>} enrichment
 * @param {Record<string, unknown>} meta
 */
function sanitizeSuggestions(enrichment, meta) {
	const sug = /** @type {Record<string, unknown>} */ (enrichment.suggestions || {});
	const pdf = String(enrichment.pdfTextPreview || '');
	const from = String(meta.from || '');

	if (sug.title && !isCleanTitle(String(sug.title))) {
		const parts = splitFilenameParts(attachmentPdfName(meta));
		if (parts.title && isCleanTitle(parts.title)) {
			sug.title = parts.title;
			addProv(enrichment, 'title', 'filename', 0.55);
		}
	}

	// Never keep a raw PDF-head dump as "summary"
	if (sug.summary && isPdfDumpSummary(String(sug.summary), pdf)) {
		delete sug.summary;
		stripProv(enrichment, 'summary');
	}

	// DOI must look like a DOI
	if (sug.doi && !/^10\.\d{4,9}\/\S+$/i.test(String(sug.doi).trim())) {
		delete sug.doi;
		stripProv(enrichment, 'doi');
	}

	// Don't credit the email sender as author
	if (sug.by && from) {
		const by = String(sug.by).toLowerCase().replace(/[^a-z]+/g, '');
		const sender = from.toLowerCase().replace(/[^a-z]+/g, '');
		if (by && sender && (sender.includes(by) || by.includes(sender.slice(0, 8)))) {
			const parts = splitFilenameParts(attachmentPdfName(meta));
			if (parts.by) {
				sug.by = parts.by;
				addProv(enrichment, 'by', 'filename', 0.5);
			} else {
				delete sug.by;
				stripProv(enrichment, 'by');
			}
		}
	}

	// Journal essays shouldn't invent a random book publisher
	if (sug.container && sug.publisher) {
		const pub = String(sug.publisher).toLowerCase();
		if (/college board|random house|penguin|self[- ]?published/.test(pub)) {
			delete sug.publisher;
			stripProv(enrichment, 'publisher');
		}
	}

	delete sug.citation;
	const generated = formatChicagoFromSug(sug);
	if (generated) {
		sug.citation = generated;
		addProv(enrichment, 'citation', 'chicago', 0.7);
	} else {
		stripProv(enrichment, 'citation');
	}
}

/** @param {string} title */
function isCleanTitle(title) {
	const t = String(title || '').trim();
	if (t.length < 4 || t.length > 140) return false;
	if (/\s[A-Za-z]$/.test(t)) return false; // "Common Sensing? O"
	if (/^\d/.test(t)) return false;
	if (/^(fwd:|re:)/i.test(t)) return false;
	if (/_/.test(t)) return false;
	return /[A-Za-z]{3,}/.test(t);
}

/** @param {string} summary @param {string} pdf */
function isPdfDumpSummary(summary, pdf) {
	const s = summary.replace(/\s+/g, ' ').trim();
	if (s.length < 40) return true;
	if (/^\d{2,4}\s+(19|20)\d{2}\b/.test(s)) return true; // "344 2023 COMMON…"
	if (/^(common sensing\?|[\d\s]{3,})/i.test(s) && /not even with/i.test(s)) return true;
	const head = pdf.replace(/\s+/g, ' ').trim().slice(0, 120).toLowerCase();
	const start = s.slice(0, 80).toLowerCase();
	if (head && start && head.includes(start.slice(0, 40))) return true;
	return false;
}

/** @param {Record<string, unknown>} meta */
function attachmentPdfName(meta) {
	return String(
		/** @type {Array<Record<string, unknown>>} */ (meta.attachments || []).find(
			(a) =>
				a.stored &&
				(a.kind === 'pdf' ||
					String(a.contentType || '').includes('pdf') ||
					String(a.filename || '')
						.toLowerCase()
						.endsWith('.pdf')),
		)?.filename || '',
	);
}

/**
 * @param {Record<string, unknown>} enrichment
 * @param {string} field
 */
function provFor(enrichment, field) {
	const list = Array.isArray(enrichment.provenance)
		? /** @type {Array<{ field?: string, source?: string, confidence?: number }>} */ (enrichment.provenance)
		: [];
	return list.find((p) => p.field === field);
}

/**
 * @param {Record<string, unknown>} enrichment
 * @param {string} field
 */
function stripProv(enrichment, field) {
	if (!Array.isArray(enrichment.provenance)) return;
	enrichment.provenance = enrichment.provenance.filter(
		(p) => /** @type {{ field?: string }} */ (p).field !== field,
	);
}

/** @param {string} filename */
function splitFilenameParts(filename) {
	if (!filename) return { raw: '', by: '', title: '', subtitle: '', year: '', issue: '', container: '' };
	const raw = filename.replace(/\.[A-Za-z0-9]+$/, '').replace(/\s+/g, ' ').trim();
	// "Hito Steyerl_ Common Sensing _ NLR 144_ November December 2023"
	const chunks = raw
		.split(/[_\u2013\u2014]+/)
		.map((s) => s.trim())
		.filter(Boolean);

	/** @type {{ raw: string, by: string, title: string, subtitle: string, year: string, issue: string, container: string }} */
	const out = { raw, by: '', title: '', subtitle: '', year: '', issue: '', container: '' };
	const yearHit = raw.match(/\b(19|20)\d{2}\b/);
	if (yearHit) out.year = yearHit[0];
	// Underscores are word chars, so avoid \b after the issue number ("NLR 144_…").
	const nlr = raw.match(/\bNLR\s*(\d+)/i);
	if (nlr) {
		out.container = 'New Left Review';
		out.issue = nlr[1];
	}

	if (chunks.length >= 2 && /^[A-Z][a-z]+(?:\s+[A-Z][a-z.'-]+)+$/.test(chunks[0])) {
		out.by = chunks[0];
		out.title = chunks[1]
			.replace(/\bNLR\s*\d+.*$/i, '')
			.replace(/\b(January|February|March|April|May|June|July|August|September|October|November|December)(\s+\w+)*\s*(19|20)\d{2}\s*$/i, '')
			.trim();
		return out;
	}
	out.title = raw
		.replace(/[_\u2013\u2014]+/g, ' ')
		.replace(/\bNLR\s*\d+.*$/i, '')
		.replace(/\s+/g, ' ')
		.trim();
	return out;
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
	let s = String(raw || '').trim();
	s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
	const start = s.indexOf('{');
	const end = s.lastIndexOf('}');
	if (start < 0 || end < 0) return null;
	let slice = s.slice(start, end + 1);
	try {
		return JSON.parse(slice);
	} catch {
		// Trailing commas / smart quotes from smaller models
		slice = slice
			.replace(/,\s*([}\]])/g, '$1')
			.replace(/[\u201C\u201D]/g, '"')
			.replace(/[\u2018\u2019]/g, "'");
		try {
			return JSON.parse(slice);
		} catch {
			return null;
		}
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
