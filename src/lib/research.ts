import { getCollection, type CollectionEntry } from 'astro:content';

export type ResearchEntry = CollectionEntry<'research'>;

/** Normalize a URL for duplicate detection (strip trailing slash, lowercase host). */
export function normalizeResearchUrl(url: string): string {
	try {
		const u = new URL(url.trim());
		u.hash = '';
		let path = u.pathname.replace(/\/+$/, '') || '/';
		return `${u.protocol}//${u.host.toLowerCase()}${path}${u.search}`;
	} catch {
		return url.trim().toLowerCase();
	}
}

export function isPublicResearch(entry: ResearchEntry): boolean {
	return !entry.data.private;
}

/** Public research nodes, newest collected first. Runs a duplicate-url check. */
export async function getPublicResearch(): Promise<ResearchEntry[]> {
	const all = await getCollection('research');
	assertUniqueResearchUrls(all.filter(isPublicResearch));
	return all
		.filter(isPublicResearch)
		.sort((a, b) => b.data.collected.valueOf() - a.data.collected.valueOf());
}

/**
 * Fail the build when two non-private nodes share a normalized `url`.
 * Private duplicates are ignored (scratch copies stay out of the public graph).
 */
export function assertUniqueResearchUrls(entries: ResearchEntry[]): void {
	const seen = new Map<string, string>();
	const dupes: string[] = [];

	for (const entry of entries) {
		const raw = entry.data.url?.trim();
		if (!raw) continue;
		const key = normalizeResearchUrl(raw);
		const prev = seen.get(key);
		if (prev) {
			dupes.push(`${key} → ${prev} and ${entry.data.slug}`);
		} else {
			seen.set(key, entry.data.slug);
		}
	}

	if (dupes.length) {
		throw new Error(
			`Duplicate research url(s) — keep one node per URL, add collections/related instead:\n  ${dupes.join('\n  ')}`,
		);
	}
}

/** Map of research slug → entries that list it in `relatedResearch`. */
export function buildResearchBacklinks(
	entries: ResearchEntry[],
): Map<string, ResearchEntry[]> {
	const bySlug = new Map(entries.map((e) => [e.data.slug, e]));
	const backlinks = new Map<string, ResearchEntry[]>();

	for (const entry of entries) {
		for (const target of entry.data.relatedResearch) {
			if (!bySlug.has(target)) continue;
			const list = backlinks.get(target) ?? [];
			if (!list.some((e) => e.data.slug === entry.data.slug)) {
				list.push(entry);
			}
			backlinks.set(target, list);
		}
	}

	for (const list of backlinks.values()) {
		list.sort((a, b) => a.data.title.localeCompare(b.data.title));
	}

	return backlinks;
}

export function researchBySlug(entries: ResearchEntry[]): Map<string, ResearchEntry> {
	return new Map(entries.map((e) => [e.data.slug, e]));
}

export function uniqueSorted(values: string[]): string[] {
	return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}
