/**
 * Chicago bibliography-form citations for research nodes.
 * Keep in sync with src/lib/chicago.ts
 */

const CITEABLE = new Set(['book', 'essay', 'film', 'archive', 'artwork', 'other']);

/**
 * @param {Record<string, unknown>} data
 * @returns {string | undefined}
 */
export function researchCitation(data) {
	const override = String(data.citation || '').trim();
	if (override) return override;
	return formatChicagoCitation(data);
}

/**
 * @param {Record<string, unknown>} data
 * @returns {string | undefined}
 */
export function formatChicagoCitation(data) {
	const type = String(data.type || '').trim();
	if (!type || !CITEABLE.has(type)) return undefined;

	const title = bibliographicTitle(data);
	if (!title) return undefined;

	switch (type) {
		case 'book':
			return formatBook(data, title);
		case 'essay':
			return formatEssay(data, title);
		case 'film':
			return formatFilm(data, title);
		case 'archive':
		case 'artwork':
		case 'other':
			return formatGeneric(data, title);
		default:
			return undefined;
	}
}

/**
 * @param {Record<string, unknown>} data
 * @returns {string | undefined}
 */
export function bibliographicTitle(data) {
	const title = String(data.title || '').trim();
	if (!title) return undefined;
	const subtitle = String(data.subtitle || '').trim();
	if (!subtitle) return title;
	if (/[:.?]$/.test(title)) return `${title} ${subtitle}`;
	return `${title}: ${subtitle}`;
}

/**
 * @param {string | undefined} by
 * @returns {string | undefined}
 */
export function formatAuthorList(by) {
	const raw = String(by || '').trim();
	if (!raw) return undefined;

	const names = raw
		.split(/\s+and\s+/i)
		.map((s) => s.trim())
		.filter(Boolean);
	if (!names.length) return undefined;

	const formatted = names.map((name, i) => (i === 0 ? invertName(name) : name));
	if (formatted.length === 1) return formatted[0];
	if (formatted.length === 2) return `${formatted[0]}, and ${formatted[1]}`;
	return `${formatted.slice(0, -1).join(', ')}, and ${formatted[formatted.length - 1]}`;
}

/**
 * @param {Record<string, unknown>} data
 * @param {string} title
 */
function formatBook(data, title) {
	const author = formatAuthorList(/** @type {string|undefined} */ (data.by));
	if (!author && !data.year) return undefined;

	const parts = [];
	if (author) parts.push(ensurePeriod(author));
	parts.push(ensurePeriod(title));
	const pub = publicationClause(data.place, data.publisher, data.year);
	if (pub) parts.push(pub);
	else if (data.year) parts.push(ensurePeriod(String(data.year)));
	appendDoiOrUrl(parts, data);
	return joinParts(parts);
}

/**
 * @param {Record<string, unknown>} data
 * @param {string} title
 */
function formatEssay(data, title) {
	const author = formatAuthorList(/** @type {string|undefined} */ (data.by));
	if (!author) return undefined;

	const parts = [ensurePeriod(author), `“${title}.”`];
	const container = String(data.container || '').trim();
	if (container) {
		let loc = container;
		const volIssue = volumeIssue(data.volume, data.issue);
		if (volIssue) loc += ` ${volIssue}`;
		if (data.year) loc += ` (${data.year})`;
		if (String(data.pages || '').trim()) loc += `: ${String(data.pages).trim()}`;
		parts.push(ensurePeriod(loc));
	} else {
		const pub = publicationClause(data.place, data.publisher, data.year);
		if (pub) parts.push(pub);
		else if (data.year) parts.push(ensurePeriod(String(data.year)));
	}
	appendDoiOrUrl(parts, data);
	return joinParts(parts);
}

/**
 * @param {Record<string, unknown>} data
 * @param {string} title
 */
function formatFilm(data, title) {
	const author = formatAuthorList(/** @type {string|undefined} */ (data.by));
	const parts = [];
	if (author) parts.push(`${author.replace(/\.$/, '')}, dir.`);
	parts.push(ensurePeriod(title));
	const pub = publicationClause(data.place, data.publisher, data.year);
	if (pub) parts.push(pub);
	else if (data.year) parts.push(ensurePeriod(String(data.year)));
	appendDoiOrUrl(parts, data);
	if (parts.length < 2) return undefined;
	return joinParts(parts);
}

/**
 * @param {Record<string, unknown>} data
 * @param {string} title
 */
function formatGeneric(data, title) {
	const author = formatAuthorList(/** @type {string|undefined} */ (data.by));
	const parts = [];
	if (author) parts.push(ensurePeriod(author));
	parts.push(ensurePeriod(title));
	const pub = publicationClause(data.place, data.publisher, data.year);
	if (pub) parts.push(pub);
	else if (data.year) parts.push(ensurePeriod(String(data.year)));
	appendDoiOrUrl(parts, data);
	if (!author && !data.year && !data.doi && !data.url) return undefined;
	return joinParts(parts);
}

/**
 * @param {unknown} place
 * @param {unknown} publisher
 * @param {unknown} year
 */
function publicationClause(place, publisher, year) {
	const p = String(place || '').trim();
	const pub = String(publisher || '').trim();
	const y = String(year || '').trim();
	if (!pub && !p) return y ? ensurePeriod(y) : undefined;
	if (p && pub && y) return `${p}: ${pub}, ${y}.`;
	if (pub && y) return `${pub}, ${y}.`;
	if (p && pub) return `${p}: ${pub}.`;
	if (pub) return ensurePeriod(pub);
	if (p && y) return `${p}, ${y}.`;
	return y ? ensurePeriod(y) : undefined;
}

/**
 * @param {unknown} volume
 * @param {unknown} issue
 */
function volumeIssue(volume, issue) {
	const v = String(volume || '').trim();
	const iss = String(issue || '').trim();
	if (v && iss) return `${v}, no. ${iss}`;
	if (v) return v;
	if (iss) return `no. ${iss}`;
	return '';
}

/**
 * @param {string[]} parts
 * @param {Record<string, unknown>} data
 */
function appendDoiOrUrl(parts, data) {
	const doi = String(data.doi || '')
		.trim()
		.replace(/^https?:\/\/doi\.org\//i, '');
	if (doi) {
		parts.push(ensurePeriod(`https://doi.org/${doi}`));
		return;
	}
	const url = String(data.url || '').trim();
	const type = String(data.type || '');
	const container = String(data.container || '').trim();
	if (url && (type === 'archive' || type === 'other' || (type === 'essay' && !container))) {
		parts.push(ensurePeriod(url));
	}
}

/**
 * @param {string} name
 */
function invertName(name) {
	if (name.includes(',')) return name.replace(/\s+,/, ',').trim();
	const tokens = name.split(/\s+/).filter(Boolean);
	if (tokens.length < 2) return name;
	const last = tokens[tokens.length - 1];
	const given = tokens.slice(0, -1).join(' ');
	return `${last}, ${given}`;
}

/**
 * @param {string} s
 */
function ensurePeriod(s) {
	const t = s.trim();
	if (!t) return t;
	return /[.!?]$/.test(t) ? t : `${t}.`;
}

/**
 * @param {string[]} parts
 */
function joinParts(parts) {
	return parts
		.join(' ')
		.replace(/\s+/g, ' ')
		.replace(/\s+\./g, '.')
		.trim();
}
