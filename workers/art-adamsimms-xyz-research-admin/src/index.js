import { requireAccess } from './auth.js';
import { deleteRepoFile, getRepoFile, listResearchFiles, putRepoFile } from './github.js';
import { copyAttachmentToFiles, getInboxItem, listInboxItems, putMeta } from './inbox.js';
import { rebuildAllIndexes } from './indexes.js';
import {
	extractUrlFromMarkdown,
	normalizeUrl,
	parseResearchMarkdown,
	serializeResearchMarkdown,
	slugify,
} from './markdown.js';
import {
	html,
	inboxItemPage,
	inboxListPage,
	json,
	libraryEditPage,
	libraryListPage,
} from './ui.js';

const BASE = '/research/admin';

/**
 * @typedef {import('./github.js').Env & { ENRICH_QUEUE?: Queue }} AdminEnv
 */

export default {
	/**
	 * @param {Request} request
	 * @param {AdminEnv} env
	 */
	async fetch(request, env) {
		const auth = await requireAccess(request, env);
		if (!auth.ok) return auth.response;

		const url = new URL(request.url);
		let path = url.pathname;
		if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);

		try {
			if (request.method === 'GET' && (path === BASE || path === `${BASE}/`)) {
				const status = url.searchParams.get('status') || 'inbox';
				const items = await listInboxItems(env.RESEARCH, status);
				return html(inboxListPage(items, status));
			}

			if (request.method === 'GET' && path.startsWith(`${BASE}/item/`)) {
				const id = path.slice(`${BASE}/item/`.length);
				const item = await getInboxItem(env.RESEARCH, id);
				if (!item) return html(inboxListPage([], 'inbox'), 404);
				const flash = url.searchParams.get('flash') || undefined;
				const error = url.searchParams.get('error') || undefined;
				return html(inboxItemPage(item, { flash, error }));
			}

			if (request.method === 'GET' && path === `${BASE}/library`) {
				return html(await renderLibraryList(env));
			}

			if (request.method === 'GET' && path.startsWith(`${BASE}/library/`)) {
				const slug = path.slice(`${BASE}/library/`.length);
				return html(await renderLibraryEdit(env, slug, url.searchParams));
			}

			if (request.method === 'GET' && path === `${BASE}/api/attachment`) {
				const key = url.searchParams.get('key');
				if (!key || key.includes('..')) return new Response('Bad key', { status: 400 });
				const obj = await env.RESEARCH.get(key);
				if (!obj) return new Response('Not found', { status: 404 });
				const headers = new Headers();
				obj.writeHttpMetadata(headers);
				headers.set('Cache-Control', 'no-store');
				return new Response(obj.body, { headers });
			}

			if (request.method === 'POST' && path === `${BASE}/api/status`) {
				const form = await request.formData();
				const id = String(form.get('id') || '');
				const status = String(form.get('status') || '');
				if (!['deferred', 'discarded', 'inbox'].includes(status)) {
					return redirect(`${BASE}/item/${id}?error=bad+status`);
				}
				const item = await getInboxItem(env.RESEARCH, id);
				if (!item) return redirect(`${BASE}/?error=not+found`);
				item.status = status;
				await putMeta(env.RESEARCH, item.prefix, item);
				return redirect(`${BASE}/?status=${status}&flash=updated`);
			}

			if (request.method === 'POST' && path === `${BASE}/api/enrich`) {
				return handleEnrich(request, env);
			}

			if (request.method === 'POST' && path === `${BASE}/api/indexes`) {
				const counts = await rebuildAllIndexes(env);
				return redirect(
					`${BASE}/?flash=${encodeURIComponent(`indexes: research ${counts.library}, works ${counts.works}, writing ${counts.writing}`)}`,
				);
			}

			if (request.method === 'POST' && path === `${BASE}/api/promote`) {
				return handlePromote(request, env);
			}

			if (request.method === 'POST' && path.startsWith(`${BASE}/api/library/`)) {
				const slug = path.slice(`${BASE}/api/library/`.length);
				const form = await request.formData();
				const method = String(form.get('_method') || 'put').toLowerCase();
				if (method === 'delete') return handleLibraryDelete(env, slug);
				return handleLibrarySave(env, slug, form);
			}

			if (path.startsWith(BASE)) {
				return new Response('Not found', { status: 404 });
			}

			return new Response('Not found', { status: 404 });
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			console.error(JSON.stringify({ event: 'admin_error', message }));
			return new Response(`Error: ${message}`, {
				status: 500,
				headers: { 'Content-Type': 'text/plain; charset=utf-8' },
			});
		}
	},
};

/**
 * @param {Request} request
 * @param {AdminEnv} env
 */
async function handleEnrich(request, env) {
	const form = await request.formData();
	const id = String(form.get('id') || '');
	const item = await getInboxItem(env.RESEARCH, id);
	if (!item) return redirect(`${BASE}/?error=not+found`);

	const status = item.enrichment?.status;
	const force = form.get('force') === '1';
	if (status === 'running' && !force) {
		return redirect(`${BASE}/item/${id}?error=${encodeURIComponent('Enrichment already running')}`);
	}
	if (status === 'queued' && !force) {
		return redirect(`${BASE}/item/${id}?flash=${encodeURIComponent('Already queued')}`);
	}

	const primaryUrl = String(form.get('primaryUrl') || '').trim();
	const forceArchive = form.get('forceArchive') === '1';
	const generation = (Number(item.enrichment?.generation) || 0) + 1;

	if (primaryUrl) {
		item.primaryUrl = primaryUrl;
	}
	item.enrichment = {
		...(item.enrichment || {}),
		status: 'queued',
		generation,
	};
	await putMeta(env.RESEARCH, item.prefix, item);

	if (!env.ENRICH_QUEUE) {
		return redirect(`${BASE}/item/${id}?error=${encodeURIComponent('ENRICH_QUEUE not bound')}`);
	}

	await env.ENRICH_QUEUE.send({
		id: item.id,
		prefix: item.prefix,
		force: true,
		forceArchive,
		primaryUrlOverride: primaryUrl || undefined,
		generation,
	});

	return redirect(`${BASE}/item/${id}?flash=enrichment+queued`);
}

/**
 * @param {Request} request
 * @param {AdminEnv} env
 */
async function handlePromote(request, env) {
	const form = await request.formData();
	const id = String(form.get('id') || '');
	const item = await getInboxItem(env.RESEARCH, id);
	if (!item) return redirect(`${BASE}/?error=not+found`);

	const title = String(form.get('title') || '').trim();
	const slug = slugify(String(form.get('slug') || title));
	const type = String(form.get('type') || 'other');
	const pageUrl = String(form.get('url') || '').trim();
	const by = String(form.get('by') || '').trim();
	const year = String(form.get('year') || '').trim();
	const status = String(form.get('status') || 'note');
	const summary = String(form.get('summary') || '').trim();
	const citation = String(form.get('citation') || '').trim();
	const quote = String(form.get('quote') || '').trim();
	const archivedUrl = String(form.get('archivedUrl') || '').trim();
	const body = String(form.get('body') || '').trim();
	const collected = String(form.get('collected') || item.collectedAt || '').slice(0, 10);
	const tags = splitCsv(String(form.get('tags') || ''));
	const collections = splitCsv(String(form.get('collections') || ''));
	const relatedResearch = splitCsv(String(form.get('relatedResearch') || ''));
	const relatedWorks = splitCsv(String(form.get('relatedWorks') || ''));
	const relatedWriting = splitCsv(String(form.get('relatedWriting') || ''));

	if (!title || !slug) {
		return redirect(`${BASE}/item/${id}?error=title+and+slug+required`);
	}

	if (pageUrl) {
		const dup = await findLibraryUrlConflict(env, pageUrl, null);
		if (dup) {
			return redirect(
				`${BASE}/item/${id}?error=${encodeURIComponent(`URL already in library as ${dup}`)}`,
			);
		}
	}

	const existing = await getRepoFile(env, `src/content/research/${slug}.md`);
	if (existing) {
		return redirect(`${BASE}/item/${id}?error=${encodeURIComponent(`Slug already exists: ${slug}`)}`);
	}

	const promotedAttachments = [];
	const sourceAtts = item.attachments || [];
	for (let i = 0; i < sourceAtts.length; i++) {
		const copied = await copyAttachmentToFiles(env.RESEARCH, sourceAtts[i], slug, i);
		if (copied.stored && copied.key) {
			promotedAttachments.push({
				url: `r2://${copied.key}`,
				kind: copied.kind || 'other',
				title: copied.title || copied.filename,
			});
		}
	}

	/** @type {Record<string, unknown>} */
	const data = {
		title,
		slug,
		type,
		status,
		collected,
		tags,
		collections,
		summary,
		attachments: promotedAttachments,
		relatedResearch,
		relatedWorks,
		relatedWriting,
	};
	if (pageUrl) data.url = pageUrl;
	if (by) data.by = by;
	if (year) data.year = year;
	if (citation) data.citation = citation;
	if (quote) data.quote = quote;
	if (archivedUrl) {
		data.archivedUrl = archivedUrl;
		data.archivedAt = new Date().toISOString().slice(0, 10);
	}

	const md = serializeResearchMarkdown(data, body);
	await putRepoFile(env, {
		path: `src/content/research/${slug}.md`,
		content: md,
		message: `research: add ${slug}`,
	});

	item.status = 'promoted';
	item.promotedSlug = slug;
	item.promotedAt = new Date().toISOString();
	await putMeta(env.RESEARCH, item.prefix, item);

	try {
		await rebuildAllIndexes(env);
	} catch (err) {
		console.error(JSON.stringify({ event: 'index_rebuild_fail', error: String(err) }));
	}

	return redirect(`${BASE}/library/${slug}?flash=promoted`);
}

/**
 * @param {AdminEnv} env
 * @param {string} slug
 * @param {FormData} form
 */
async function handleLibrarySave(env, slug, form) {
	const path = `src/content/research/${slug}.md`;
	const existing = await getRepoFile(env, path);
	if (!existing) return redirect(`${BASE}/library?error=not+found`);

	const rawOverride = String(form.get('raw') || '').trim();
	let content;
	if (rawOverride) {
		content = rawOverride.endsWith('\n') ? rawOverride : `${rawOverride}\n`;
	} else {
		const title = String(form.get('title') || '').trim();
		const type = String(form.get('type') || 'other');
		const pageUrl = String(form.get('url') || '').trim();
		const by = String(form.get('by') || '').trim();
		const year = String(form.get('year') || '').trim();
		const status = String(form.get('status') || 'note');
		const summary = String(form.get('summary') || '').trim();
		const citation = String(form.get('citation') || '').trim();
		const body = String(form.get('body') || '');
		const tags = splitCsv(String(form.get('tags') || ''));
		const collections = splitCsv(String(form.get('collections') || ''));

		const prev = parseResearchMarkdown(existing.content);
		if (pageUrl) {
			const dup = await findLibraryUrlConflict(env, pageUrl, slug);
			if (dup) {
				return redirect(
					`${BASE}/library/${slug}?error=${encodeURIComponent(`URL already used by ${dup}`)}`,
				);
			}
		}

		/** @type {Record<string, unknown>} */
		const data = {
			...prev.data,
			title,
			slug,
			type,
			status,
			tags,
			collections,
			summary,
		};
		if (pageUrl) data.url = pageUrl;
		else delete data.url;
		if (by) data.by = by;
		else delete data.by;
		if (year) data.year = year;
		else delete data.year;
		if (citation) data.citation = citation;
		else delete data.citation;

		content = serializeResearchMarkdown(data, body);
	}

	await putRepoFile(env, {
		path,
		content,
		message: `research: update ${slug}`,
		sha: existing.sha,
	});

	try {
		await rebuildAllIndexes(env);
	} catch (err) {
		console.error(JSON.stringify({ event: 'index_rebuild_fail', error: String(err) }));
	}

	return redirect(`${BASE}/library/${slug}?flash=saved`);
}

/**
 * @param {AdminEnv} env
 * @param {string} slug
 */
async function handleLibraryDelete(env, slug) {
	const path = `src/content/research/${slug}.md`;
	const existing = await getRepoFile(env, path);
	if (!existing) return redirect(`${BASE}/library?error=not+found`);
	await deleteRepoFile(env, {
		path,
		sha: existing.sha,
		message: `research: remove ${slug}`,
	});
	try {
		await rebuildAllIndexes(env);
	} catch (err) {
		console.error(JSON.stringify({ event: 'index_rebuild_fail', error: String(err) }));
	}
	return redirect(`${BASE}/library?flash=deleted`);
}

/**
 * @param {AdminEnv} env
 */
async function renderLibraryList(env) {
	const files = await listResearchFiles(env);
	const entries = [];
	for (const f of files) {
		const slug = f.name.replace(/\.md$/, '');
		const file = await getRepoFile(env, f.path);
		if (!file) continue;
		const { data } = parseResearchMarkdown(file.content);
		entries.push({
			slug,
			title: String(data.title || slug),
			type: String(data.type || ''),
		});
	}
	entries.sort((a, b) => a.title.localeCompare(b.title));
	return libraryListPage(entries);
}

/**
 * @param {AdminEnv} env
 * @param {string} slug
 * @param {URLSearchParams} params
 */
async function renderLibraryEdit(env, slug, params) {
	const file = await getRepoFile(env, `src/content/research/${slug}.md`);
	if (!file) {
		return libraryListPage([]);
	}
	const parsed = parseResearchMarkdown(file.content);
	return libraryEditPage(
		{ slug, raw: file.content, data: parsed.data, body: parsed.body },
		{
			flash: params.get('flash') || undefined,
			error: params.get('error') || undefined,
		},
	);
}

/**
 * @param {AdminEnv} env
 * @param {string} url
 * @param {string | null} exceptSlug
 */
async function findLibraryUrlConflict(env, url, exceptSlug) {
	const target = normalizeUrl(url);
	const files = await listResearchFiles(env);
	for (const f of files) {
		const slug = f.name.replace(/\.md$/, '');
		if (exceptSlug && slug === exceptSlug) continue;
		const file = await getRepoFile(env, f.path);
		if (!file) continue;
		const found = extractUrlFromMarkdown(file.content);
		if (found && normalizeUrl(found) === target) return slug;
	}
	return null;
}

/** @param {string} s */
function splitCsv(s) {
	return s
		.split(',')
		.map((x) => x.trim())
		.filter(Boolean);
}

/** @param {string} to */
function redirect(to) {
	return Response.redirect(to, 303);
}
