/** Work slugs kept routable but excluded from sitemap / index. */
export const HIDDEN_WORK_SLUGS = new Set(['from-to', 'washed-up', 'newfoundland']);

export const SITE_NAME = 'Adam Simms';
export const SITE_URL = 'https://art.adamsimms.xyz';
export const DEFAULT_DESCRIPTION = 'Photography and art by Adam Simms';
/**
 * Sitewide brand card for non-project pages (home, works index, CV).
 * Prefer JPG — social crawlers often skip AVIF.
 */
export const DEFAULT_OG_IMAGE = 'https://media.adamsimms.xyz/work/light-house/01.jpg';
export const DEFAULT_OG_IMAGE_ALT =
	'Light House — a glowing wireframe house on a dark shoreline';

export const PERSON_SAME_AS = [
	'https://github.com/adamsimms',
	'https://www.linkedin.com/in/adamsimms',
	'https://www.concordia.ca/faculty/adam-simms.html',
] as const;

/** Prefer a raster social image; map AVIF covers to JPG fallbacks when possible. */
export function socialImageUrl(src?: string | null, fallback?: string | null): string {
	const candidate = fallback?.trim() || src?.trim() || '';
	if (!candidate) return DEFAULT_OG_IMAGE;
	if (candidate.endsWith('.avif')) {
		return candidate.replace(/\.avif$/i, '.jpg');
	}
	return candidate;
}

export function metaDescription(...candidates: Array<string | undefined | null>): string {
	for (const value of candidates) {
		const trimmed = value?.trim();
		if (trimmed) return trimmed;
	}
	return DEFAULT_DESCRIPTION;
}

export function absoluteUrl(pathOrUrl: string, site = SITE_URL): string {
	if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
	const base = site.replace(/\/$/, '');
	const path = pathOrUrl.startsWith('/') ? pathOrUrl : `/${pathOrUrl}`;
	return `${base}${path === '/' ? '' : path}`;
}

export function isHiddenWorkSlug(slug: string): boolean {
	return HIDDEN_WORK_SLUGS.has(slug);
}
