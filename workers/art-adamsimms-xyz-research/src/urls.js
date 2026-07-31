import { FILE_EXTENSIONS, SIGNATURE_HOSTS } from './constants.js';

const TRACKING_PARAMS = new Set([
	'utm_source',
	'utm_medium',
	'utm_campaign',
	'utm_term',
	'utm_content',
	'utm_id',
	'fbclid',
	'gclid',
	'gclsrc',
	'dclid',
	'msclkid',
	'mc_cid',
	'mc_eid',
	'igshid',
	'ref',
	'source',
]);

const JUNK_PATH =
	/\/(unsubscribe|preferences|opt[-_]?out|manage-subscription|email-pref|verify-email|confirm-subscription)(\/|$)/i;

/**
 * @param {string} url
 * @returns {string}
 */
export function normalizeUrl(url) {
	try {
		const u = new URL(url.trim());
		if (u.protocol !== 'http:' && u.protocol !== 'https:') return url.trim().toLowerCase();
		u.hash = '';
		u.hostname = u.hostname.toLowerCase();
		for (const key of [...u.searchParams.keys()]) {
			if (TRACKING_PARAMS.has(key.toLowerCase()) || key.toLowerCase().startsWith('utm_')) {
				u.searchParams.delete(key);
			}
		}
		let path = u.pathname.replace(/\/+$/, '') || '/';
		u.pathname = path;
		return u.toString();
	} catch {
		return url.trim().toLowerCase();
	}
}

/**
 * @param {string} text
 * @returns {string[]}
 */
export function extractUrls(text) {
	if (!text) return [];
	const matches = text.match(/https?:\/\/[^\s<>"')\]]+/gi) || [];
	return matches.map((raw) => raw.replace(/[.,;:!?)]+$/, ''));
}

/**
 * @param {string} hostname
 * @returns {boolean}
 */
export function isSignatureHost(hostname) {
	const host = hostname.toLowerCase().replace(/\.$/, '');
	return SIGNATURE_HOSTS.some((sig) => host === sig || host.endsWith(`.${sig}`));
}

/**
 * @param {string} url
 * @returns {boolean}
 */
export function isSignatureUrl(url) {
	try {
		return isSignatureHost(new URL(url).hostname);
	} catch {
		return false;
	}
}

/**
 * @param {string} url
 * @returns {boolean}
 */
export function isJunkUrl(url) {
	try {
		const u = new URL(url);
		if (u.protocol === 'mailto:') return true;
		if (JUNK_PATH.test(u.pathname)) return true;
		return false;
	} catch {
		return true;
	}
}

/**
 * Prefer file-like / real content URLs; never use signature hosts as primary.
 * @param {string[]} urls
 * @returns {string | null}
 */
export function pickPrimaryUrl(urls) {
	const cleaned = [];
	const seen = new Set();
	for (const raw of urls) {
		if (isJunkUrl(raw)) continue;
		const n = normalizeUrl(raw);
		if (seen.has(n)) continue;
		seen.add(n);
		cleaned.push(n);
	}
	if (!cleaned.length) return null;

	const content = cleaned.filter((u) => !isSignatureUrl(u));
	if (!content.length) return null; // signature-only (e.g. PDF + footer link)

	const fileLike = content.find((u) => looksLikeFileUrl(u));
	return fileLike || content[0];
}

/**
 * @param {string} url
 * @returns {boolean}
 */
export function looksLikeFileUrl(url) {
	try {
		const path = new URL(url).pathname.toLowerCase();
		return FILE_EXTENSIONS.some((ext) => path.endsWith(ext));
	} catch {
		return false;
	}
}
