/** Limits and constants for research email capture. */

export const MAX_RAW_BYTES = 15 * 1024 * 1024;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_BODY_TEXT = 16 * 1024;
export const MAX_SUBJECT_LENGTH = 1000;
export const FETCH_TIMEOUT_MS = 4000;
export const MAX_HTML_BYTES = 1 * 1024 * 1024;
export const MAX_REDIRECTS = 3;
export const USER_AGENT =
	'Mozilla/5.0 (compatible; AdamSimmsResearchBot/1.0; +https://art.adamsimms.xyz)';

export const DEFAULT_ALLOWLIST = ['adamsimms@gmail.com', 'hello@adamsimms.xyz'];

/**
 * Hosts from email signatures / personal sites — never chosen as primaryUrl
 * (still listed in urls[] if present). Match exact host or subdomain.
 */
export const SIGNATURE_HOSTS = [
	'adamsimms.xyz',
	'art.adamsimms.xyz',
	'adamsim.ms',
	'pinchards.is',
	'media.adamsimms.xyz',
	'www.linkedin.com',
	'linkedin.com',
	'github.com',
	'www.github.com',
	'www.concordia.ca',
	'concordia.ca',
];

/** Content types we will store from email attachments or linked downloads. */
export const STOREABLE_TYPES = [
	'application/pdf',
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/avif',
	'image/tiff',
	'text/plain',
	'text/markdown',
	'application/epub+zip',
];

export const FILE_EXTENSIONS = [
	'.pdf',
	'.jpg',
	'.jpeg',
	'.png',
	'.gif',
	'.webp',
	'.avif',
	'.tif',
	'.tiff',
	'.txt',
	'.md',
	'.epub',
];
