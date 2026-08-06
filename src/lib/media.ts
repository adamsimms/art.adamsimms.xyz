/**
 * Derive a hover-sized media URL from a full cover URL.
 * `…/01.avif` → `…/01-hover.avif`, `…/poster.avif` → `…/poster-hover.avif`
 */
export function hoverMediaUrl(url) {
	if (!url || typeof url !== 'string') return url;
	return url.replace(/(\.[a-z0-9]+)(\?.*)?$/i, '-hover$1$2');
}
