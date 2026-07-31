import { LIBRARY_INDEX_KEY, WORKS_INDEX_KEY, WRITING_INDEX_KEY } from './constants.js';
import { log, normalizeUrl } from './fetch.js';

/**
 * @typedef {{ slug: string, title: string, type?: string, tags?: string[], collections?: string[], url?: string, by?: string }} LibraryEntry
 * @typedef {{ slug: string, title: string, tags?: string[], year?: string }} SiteEntry
 */

/**
 * @param {R2Bucket} bucket
 * @param {string} key
 * @returns {Promise<any[]>}
 */
export async function readIndex(bucket, key) {
	const obj = await bucket.get(key);
	if (!obj) return [];
	try {
		const data = await obj.json();
		return Array.isArray(data) ? data : [];
	} catch {
		return [];
	}
}

/**
 * @param {R2Bucket} bucket
 * @param {string} key
 * @param {unknown[]} data
 */
export async function writeIndex(bucket, key, data) {
	await bucket.put(key, JSON.stringify(data, null, 2), {
		httpMetadata: { contentType: 'application/json' },
	});
}

/**
 * @param {R2Bucket} bucket
 */
export async function loadAllIndexes(bucket) {
	const [library, works, writing] = await Promise.all([
		readIndex(bucket, LIBRARY_INDEX_KEY),
		readIndex(bucket, WORKS_INDEX_KEY),
		readIndex(bucket, WRITING_INDEX_KEY),
	]);
	return { library, works, writing };
}

/**
 * @param {LibraryEntry[]} library
 * @param {string} url
 */
export function findLibraryByUrl(library, url) {
	if (!url) return null;
	const target = normalizeUrl(url);
	for (const e of library) {
		if (e.url && normalizeUrl(e.url) === target) {
			return { slug: e.slug, title: e.title || e.slug };
		}
	}
	return null;
}

/**
 * @param {LibraryEntry[]} library
 */
export function vocabFromLibrary(library) {
	const tags = new Set();
	const collections = new Set();
	for (const e of library) {
		for (const t of e.tags || []) tags.add(t);
		for (const c of e.collections || []) collections.add(c);
	}
	return { tags: [...tags].sort(), collections: [...collections].sort() };
}

/**
 * Deterministic graph overlap scoring.
 * @param {{ title?: string, tags?: string[], collections?: string[], by?: string, summary?: string }} query
 * @param {{ library: LibraryEntry[], works: SiteEntry[], writing: SiteEntry[] }} indexes
 */
export function graphHints(query, indexes) {
	const qTags = new Set((query.tags || []).map((t) => t.toLowerCase()));
	const qCols = new Set((query.collections || []).map((c) => c.toLowerCase()));
	const qTitle = (query.title || '').toLowerCase();
	const qBy = (query.by || '').toLowerCase();
	const qText = `${qTitle} ${qBy} ${(query.summary || '').toLowerCase()}`;

	/** @param {string} title @param {string[]} tags */
	function score(title, tags = []) {
		let s = 0;
		const t = title.toLowerCase();
		for (const tag of tags) {
			if (qTags.has(tag.toLowerCase())) s += 3;
			if (qText.includes(tag.toLowerCase())) s += 1;
		}
		if (qTitle && t && (t.includes(qTitle.slice(0, 24)) || qTitle.includes(t.slice(0, 24)))) s += 4;
		if (qBy && t.includes(qBy)) s += 2;
		return s;
	}

	const research = indexes.library
		.map((e) => ({
			slug: e.slug,
			title: e.title,
			score: score(e.title, [...(e.tags || []), ...(e.collections || [])]) + (qCols.size ? (e.collections || []).filter((c) => qCols.has(c.toLowerCase())).length * 2 : 0),
		}))
		.filter((x) => x.score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, 8);

	const works = indexes.works
		.map((e) => ({ slug: e.slug, title: e.title, score: score(e.title, e.tags || []) }))
		.filter((x) => x.score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, 6);

	const writing = indexes.writing
		.map((e) => ({ slug: e.slug, title: e.title, score: score(e.title, e.tags || []) }))
		.filter((x) => x.score > 0)
		.sort((a, b) => b.score - a.score)
		.slice(0, 6);

	return { research, works, writing };
}

/**
 * Rebuild research library index from parsed entries.
 * @param {R2Bucket} bucket
 * @param {LibraryEntry[]} entries
 */
export async function writeLibraryIndex(bucket, entries) {
	await writeIndex(bucket, LIBRARY_INDEX_KEY, entries);
	log('index_write', { key: LIBRARY_INDEX_KEY, count: entries.length });
}

/**
 * @param {R2Bucket} bucket
 * @param {SiteEntry[]} works
 * @param {SiteEntry[]} writing
 */
export async function writeSiteIndexes(bucket, works, writing) {
	await writeIndex(bucket, WORKS_INDEX_KEY, works);
	await writeIndex(bucket, WRITING_INDEX_KEY, writing);
	log('index_write', { key: 'site', works: works.length, writing: writing.length });
}

export { LIBRARY_INDEX_KEY, WORKS_INDEX_KEY, WRITING_INDEX_KEY };
