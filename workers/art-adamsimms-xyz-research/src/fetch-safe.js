import {
	FETCH_TIMEOUT_MS,
	MAX_ATTACHMENT_BYTES,
	MAX_HTML_BYTES,
	MAX_REDIRECTS,
	STOREABLE_TYPES,
	USER_AGENT,
} from './constants.js';
import { looksLikeFileUrl } from './urls.js';

/**
 * Block private / link-local / metadata hosts (SSRF).
 * @param {string} hostname
 * @returns {boolean}
 */
export function isBlockedHost(hostname) {
	const host = hostname.toLowerCase().replace(/\.$/, '');
	if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
	if (host === 'metadata.google.internal') return true;

	// IPv6 literals
	if (host.includes(':')) {
		const h = host.replace(/^\[|\]$/g, '');
		if (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return true;
		return false;
	}

	const parts = host.split('.').map((p) => Number(p));
	if (parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
		const [a, b] = parts;
		if (a === 10) return true;
		if (a === 127) return true;
		if (a === 0) return true;
		if (a === 169 && b === 254) return true;
		if (a === 172 && b >= 16 && b <= 31) return true;
		if (a === 192 && b === 168) return true;
		if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
	}
	return false;
}

/**
 * @param {string} urlString
 * @returns {{ ok: true, url: URL } | { ok: false, reason: string }}
 */
export function validateFetchUrl(urlString) {
	let url;
	try {
		url = new URL(urlString);
	} catch {
		return { ok: false, reason: 'invalid_url' };
	}
	if (url.protocol !== 'http:' && url.protocol !== 'https:') {
		return { ok: false, reason: 'bad_protocol' };
	}
	if (isBlockedHost(url.hostname)) {
		return { ok: false, reason: 'blocked_host' };
	}
	return { ok: true, url };
}

/**
 * Fetch with timeout, redirect limit, and host re-check.
 * @param {string} urlString
 * @param {{ maxBytes?: number, accept?: string }} [opts]
 * @returns {Promise<{ ok: true, response: Response, finalUrl: string, body: ArrayBuffer } | { ok: false, reason: string }>}
 */
export async function safeFetch(urlString, opts = {}) {
	const maxBytes = opts.maxBytes ?? MAX_HTML_BYTES;
	let current = urlString;

	for (let i = 0; i <= MAX_REDIRECTS; i++) {
		const check = validateFetchUrl(current);
		if (!check.ok) return check;

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
		let response;
		try {
			response = await fetch(current, {
				method: 'GET',
				redirect: 'manual',
				signal: controller.signal,
				headers: {
					'User-Agent': USER_AGENT,
					Accept: opts.accept || 'text/html,application/xhtml+xml,application/pdf,image/*,*/*;q=0.8',
				},
			});
		} catch (err) {
			clearTimeout(timer);
			const msg = err instanceof Error ? err.name : 'fetch_error';
			return { ok: false, reason: msg === 'AbortError' ? 'timeout' : 'fetch_error' };
		}
		clearTimeout(timer);

		if ([301, 302, 303, 307, 308].includes(response.status)) {
			const loc = response.headers.get('location');
			if (!loc) return { ok: false, reason: 'redirect_missing' };
			current = new URL(loc, current).toString();
			continue;
		}

		if (!response.ok) {
			return { ok: false, reason: `http_${response.status}` };
		}

		const len = Number(response.headers.get('content-length') || 0);
		if (len && len > maxBytes) {
			return { ok: false, reason: 'too_large' };
		}

		const reader = response.body?.getReader();
		if (!reader) return { ok: false, reason: 'empty_body' };

		const chunks = [];
		let total = 0;
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			total += value.byteLength;
			if (total > maxBytes) {
				try {
					await reader.cancel();
				} catch {
					/* ignore */
				}
				return { ok: false, reason: 'too_large' };
			}
			chunks.push(value);
		}

		const body = concatBytes(chunks);
		return { ok: true, response, finalUrl: current, body };
	}

	return { ok: false, reason: 'too_many_redirects' };
}

/**
 * @param {Uint8Array[]} chunks
 * @returns {ArrayBuffer}
 */
function concatBytes(chunks) {
	const total = chunks.reduce((n, c) => n + c.byteLength, 0);
	const out = new Uint8Array(total);
	let offset = 0;
	for (const c of chunks) {
		out.set(c, offset);
		offset += c.byteLength;
	}
	return out.buffer;
}

/**
 * @param {string} html
 * @returns {{ title?: string, description?: string, image?: string }}
 */
export function parseOpenGraph(html) {
	/** @param {string} prop */
	const meta = (prop) => {
		const re = new RegExp(
			`<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']+)["'][^>]*>|<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${prop}["'][^>]*>`,
			'i',
		);
		const m = html.match(re);
		return m ? (m[1] || m[2] || '').trim() : undefined;
	};

	const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i);
	const title = meta('og:title') || meta('twitter:title') || (titleTag ? decodeEntities(titleTag[1].trim()) : undefined);
	const description = meta('og:description') || meta('twitter:description') || meta('description');
	const image = meta('og:image') || meta('twitter:image');

	return {
		title: title ? decodeEntities(title).slice(0, 500) : undefined,
		description: description ? decodeEntities(description).slice(0, 1000) : undefined,
		image: image || undefined,
	};
}

/**
 * @param {string} s
 * @returns {string}
 */
function decodeEntities(s) {
	return s
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&nbsp;/g, ' ');
}

/**
 * @param {string} contentType
 * @returns {boolean}
 */
export function isStoreableContentType(contentType) {
	const base = (contentType || '').split(';')[0].trim().toLowerCase();
	if (!base) return false;
	if (STOREABLE_TYPES.includes(base)) return true;
	if (base.startsWith('image/')) return true;
	return false;
}

/**
 * Decide whether a URL response should be saved as a file attachment.
 * @param {string} url
 * @param {string} contentType
 * @returns {boolean}
 */
export function shouldStoreAsFile(url, contentType) {
	if (isStoreableContentType(contentType)) return true;
	if (looksLikeFileUrl(url) && !/text\/html/i.test(contentType || '')) return true;
	return false;
}

/**
 * @param {string} url
 * @param {string} contentType
 * @returns {string}
 */
export function filenameFromUrl(url, contentType) {
	try {
		const path = new URL(url).pathname;
		const base = path.split('/').filter(Boolean).pop() || 'download';
		if (base.includes('.')) return sanitizeFilename(base);
	} catch {
		/* fall through */
	}
	const ext = extForType(contentType);
	return sanitizeFilename(`download${ext}`);
}

/**
 * @param {string} name
 * @returns {string}
 */
export function sanitizeFilename(name) {
	return name.replace(/[^\w.\-()+ ]+/g, '_').slice(0, 120) || 'file';
}

/**
 * @param {string} contentType
 * @returns {string}
 */
function extForType(contentType) {
	const base = (contentType || '').split(';')[0].trim().toLowerCase();
	const map = {
		'application/pdf': '.pdf',
		'image/jpeg': '.jpg',
		'image/png': '.png',
		'image/gif': '.gif',
		'image/webp': '.webp',
		'image/avif': '.avif',
		'text/plain': '.txt',
		'text/markdown': '.md',
	};
	return map[base] || '';
}

export { MAX_ATTACHMENT_BYTES };
