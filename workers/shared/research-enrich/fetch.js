import {
	FETCH_TIMEOUT_MS,
	MAX_HTML_BYTES,
	MAX_REDIRECTS,
	STOREABLE_TYPES,
	USER_AGENT,
} from './constants.js';

/**
 * @param {string} hostname
 */
export function isBlockedHost(hostname) {
	const host = hostname.toLowerCase().replace(/\.$/, '');
	if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
	if (host === 'metadata.google.internal') return true;
	if (host.includes(':')) {
		const h = host.replace(/^\[|\]$/g, '');
		if (h === '::1' || h.startsWith('fc') || h.startsWith('fd') || h.startsWith('fe80')) return true;
		return false;
	}
	const parts = host.split('.').map((p) => Number(p));
	if (parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
		const [a, b] = parts;
		if (a === 10 || a === 127 || a === 0) return true;
		if (a === 169 && b === 254) return true;
		if (a === 172 && b >= 16 && b <= 31) return true;
		if (a === 192 && b === 168) return true;
		if (a === 100 && b >= 64 && b <= 127) return true;
	}
	return false;
}

/**
 * @param {string} urlString
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
 * @param {string} urlString
 * @param {{ maxBytes?: number, timeoutMs?: number, userAgent?: string, accept?: string }} [opts]
 */
export async function safeFetch(urlString, opts = {}) {
	const maxBytes = opts.maxBytes ?? MAX_HTML_BYTES;
	const timeoutMs = opts.timeoutMs ?? FETCH_TIMEOUT_MS;
	const ua = opts.userAgent || USER_AGENT;
	let current = urlString;

	for (let i = 0; i <= MAX_REDIRECTS; i++) {
		const check = validateFetchUrl(current);
		if (!check.ok) return check;

		const controller = new AbortController();
		const timer = setTimeout(() => controller.abort(), timeoutMs);
		let response;
		try {
			response = await fetch(current, {
				method: 'GET',
				redirect: 'manual',
				signal: controller.signal,
				headers: {
					'User-Agent': ua,
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

		return { ok: true, response, finalUrl: current, body: concatBytes(chunks) };
	}

	return { ok: false, reason: 'too_many_redirects' };
}

/** @param {Uint8Array[]} chunks */
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

/** @param {string} s */
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
 * Wallabag-style plain text from HTML (capped).
 * @param {string} html
 * @param {number} maxChars
 */
export function readerExcerpt(html, maxChars) {
	let t = html
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
		.replace(/<(nav|footer|header|aside|form)[\s\S]*?<\/\1>/gi, ' ')
		.replace(/<!--[\s\S]*?-->/g, ' ');
	t = t.replace(/<[^>]+>/g, ' ');
	t = decodeEntities(t).replace(/\s+/g, ' ').trim();
	if (t.length <= maxChars) return t;
	return `${t.slice(0, maxChars)}…`;
}

/**
 * @param {string} contentType
 */
export function isStoreableContentType(contentType) {
	const base = (contentType || '').split(';')[0].trim().toLowerCase();
	if (!base) return false;
	if (STOREABLE_TYPES.includes(base)) return true;
	if (base.startsWith('image/')) return true;
	return false;
}

/**
 * @param {string} url
 * @param {string} contentType
 */
export function shouldStoreAsFile(url, contentType) {
	if (isStoreableContentType(contentType)) return true;
	try {
		const path = new URL(url).pathname.toLowerCase();
		if (/\.(pdf|jpe?g|png|gif|webp|avif|tif|tiff|txt|md|epub)$/i.test(path)) {
			if (!/text\/html/i.test(contentType || '')) return true;
		}
	} catch {
		/* ignore */
	}
	return false;
}

/**
 * @param {string} url
 * @param {string} contentType
 */
export function filenameFromUrl(url, contentType) {
	try {
		const path = new URL(url).pathname;
		const base = path.split('/').filter(Boolean).pop() || 'download';
		if (base.includes('.')) return sanitizeFilename(base);
	} catch {
		/* fall through */
	}
	const base = (contentType || '').split(';')[0].trim().toLowerCase();
	const map = {
		'application/pdf': '.pdf',
		'image/jpeg': '.jpg',
		'image/png': '.png',
		'image/gif': '.gif',
		'image/webp': '.webp',
	};
	return sanitizeFilename(`download${map[base] || ''}`);
}

/** @param {string} name */
export function sanitizeFilename(name) {
	return name.replace(/[^\w.\-()+ ]+/g, '_').slice(0, 120) || 'file';
}

/**
 * Rough PDF text for DOI/ISBN + LLM preview (no pdf.js).
 * @param {ArrayBuffer} buffer
 * @param {number} maxChars
 * @param {number} [scanBytes]
 */
export function extractPdfTextRough(buffer, maxChars, scanBytes = 2 * 1024 * 1024) {
	const slice = buffer.byteLength > scanBytes ? buffer.slice(0, scanBytes) : buffer;
	const s = new TextDecoder('latin1').decode(slice);
	const parts = s.match(/[\x20-\x7E]{4,}/g) || [];
	const text = parts.join(' ').replace(/\s+/g, ' ').trim();
	if (text.length <= maxChars) return text;
	return text.slice(0, maxChars);
}

/**
 * @param {string} text
 * @param {string} [url]
 */
export function extractIds(text, url = '') {
	const hay = `${url}\n${text}`;
	const doiMatch = hay.match(/\b10\.\d{4,9}\/[^\s<>"']+/i);
	let doi = doiMatch ? doiMatch[0].replace(/[.,;:)\]\}]+$/, '') : undefined;
	if (doi) {
		try {
			doi = decodeURIComponent(doi);
		} catch {
			/* keep */
		}
	}

	const isbn13 = hay.match(/\b97[89][-\s]?\d{1,5}[-\s]?\d{1,7}[-\s]?\d{1,7}[-\s]?\d\b/);
	const isbn10 = hay.match(/\bISBN(?:-10)?[:\s]*([\dX]{10})\b/i);
	const isbn = isbn13
		? isbn13[0].replace(/[-\s]/g, '')
		: isbn10
			? isbn10[1].replace(/[-\s]/g, '')
			: undefined;

	let source = 'none';
	if (doi || isbn) {
		if (url && ((doi && url.includes(doi.slice(0, 12))) || /isbn|doi\.org/i.test(url))) source = 'url';
		else if (text) source = 'pdf';
		else source = 'url';
	}

	return { doi, isbn, source };
}

/**
 * @param {string} url
 */
export function normalizeUrl(url) {
	try {
		const u = new URL(url.trim());
		u.hash = '';
		const drop = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'fbclid', 'gclid', 'mc_cid', 'mc_eid'];
		for (const k of drop) u.searchParams.delete(k);
		u.hostname = u.hostname.toLowerCase();
		let path = u.pathname;
		if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
		u.pathname = path;
		return u.toString();
	} catch {
		return url.trim();
	}
}

/**
 * @template T
 * @param {Promise<T>} promise
 * @param {number} ms
 * @param {string} reason
 */
export function withTimeout(promise, ms, reason = 'timeout') {
	return new Promise((resolve, reject) => {
		const t = setTimeout(() => reject(new Error(reason)), ms);
		promise.then(
			(v) => {
				clearTimeout(t);
				resolve(v);
			},
			(e) => {
				clearTimeout(t);
				reject(e);
			},
		);
	});
}

/**
 * @param {string} event
 * @param {Record<string, unknown>} fields
 */
export function log(event, fields) {
	console.log(JSON.stringify({ event, ...fields }));
}
