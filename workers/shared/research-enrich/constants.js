/** Shared enrichment limits */

export const FETCH_TIMEOUT_MS = 8000;
export const STAGE_TIMEOUT_MS = 12000;
export const LLM_TIMEOUT_MS = 20000;
export const MAX_HTML_BYTES = 1 * 1024 * 1024;
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_REDIRECTS = 3;
export const READER_MAX_CHARS = 4000;
export const PDF_MAX_CHARS = 8000;
export const PDF_SCAN_BYTES = 2 * 1024 * 1024;
export const LLM_MODEL = '@cf/meta/llama-3.1-8b-instruct';

export const USER_AGENT =
	'AdamSimmsResearchBot/1.1 (+https://art.adamsimms.xyz; mailto:hello@adamsimms.xyz)';

export const CROSSREF_UA =
	'art.adamsimms.xyz-research/1.1 (mailto:hello@adamsimms.xyz)';

export const LIBRARY_INDEX_KEY = 'library/index.json';
export const WORKS_INDEX_KEY = 'site/works.json';
export const WRITING_INDEX_KEY = 'site/writing.json';

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
