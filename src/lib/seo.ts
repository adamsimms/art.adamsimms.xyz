/** Work slugs kept routable but excluded from sitemap / index. */
export const HIDDEN_WORK_SLUGS = new Set(['from-to', 'washed-up', 'newfoundland']);

/** Pathname form of hidden works (no trailing slash): keep in sync with `HIDDEN_WORK_SLUGS`. */
export const HIDDEN_PATHS = new Set(
	[...HIDDEN_WORK_SLUGS].map((slug) => `/${slug}`),
);

/**
 * Surfaces that stay buildable but are not linked or sitemap'd until go-live.
 * Currently: Maps (`/maps`…) and Research (`/research`…).
 */
export function isStagedPath(pathname: string): boolean {
	const path = cleanPathname(pathname);
	return (
		path === '/maps' ||
		path.startsWith('/maps/') ||
		path === '/research' ||
		path.startsWith('/research/')
	);
}

/** Paths omitted from `@astrojs/sitemap` (hidden works + staged surfaces). */
export function isExcludedFromSitemap(pathname: string): boolean {
	const path = cleanPathname(pathname);
	return HIDDEN_PATHS.has(path) || isStagedPath(path);
}

export const SITE_NAME = 'Adam Simms';
export const SITE_URL = 'https://art.adamsimms.xyz';
export const DEFAULT_DESCRIPTION =
	'Canadian media artist Adam Simms: photography, video, and installation on belonging, displacement, and Newfoundland resettlement.';
/**
 * Sitewide brand card for non-project pages (home, works index, CV, maps).
 * Prefer JPG: social crawlers often skip AVIF.
 */
export const DEFAULT_OG_IMAGE = 'https://media.adamsimms.xyz/work/light-house/01.jpg';
export const DEFAULT_OG_IMAGE_ALT =
	'Light House: a glowing wireframe house on a dark shoreline';

/** Portrait used in Person JSON-LD and About OG. */
export const PERSON_IMAGE = `${SITE_URL}/img/about/portrait.jpg`;

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

/**
 * Normalize Astro build pathnames for canonicals.
 * With `build.format: 'file'`, `Astro.url.pathname` can be `/about.html` or `/index.html`.
 */
export function cleanPathname(pathname: string): string {
	let path = pathname.replace(/\/$/, '') || '/';
	if (path.endsWith('.html')) path = path.slice(0, -5) || '/';
	if (path === '/index') path = '/';
	return path || '/';
}

export function isHiddenWorkSlug(slug: string): boolean {
	return HIDDEN_WORK_SLUGS.has(slug);
}
