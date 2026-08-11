/**
 * Chicago bibliography-form citations for research nodes.
 * `citation` frontmatter remains an optional hand override.
 */

export type ChicagoInput = {
	title?: string;
	subtitle?: string;
	type?: string;
	by?: string;
	year?: string;
	publisher?: string;
	place?: string;
	doi?: string;
	url?: string;
	container?: string;
	volume?: string;
	issue?: string;
	pages?: string;
	/** Optional override — returned as-is when non-empty. */
	citation?: string;
};

const CITEABLE = new Set(['book', 'essay', 'film', 'archive', 'artwork', 'other']);

/** Display citation: hand override, else generated Chicago, else undefined. */
export function researchCitation(data: ChicagoInput): string | undefined {
	const override = data.citation?.trim();
	if (override) return override;
	return formatChicagoCitation(data);
}

/**
 * Build a Chicago bibliography string from structured fields.
 * Returns undefined when the type is non-bibliographic or required pieces are missing.
 */
export function formatChicagoCitation(data: ChicagoInput): string | undefined {
	const type = data.type?.trim();
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

/** Title, or Title: Subtitle when subtitle is set. */
export function bibliographicTitle(data: ChicagoInput): string | undefined {
	const title = data.title?.trim();
	if (!title) return undefined;
	const subtitle = data.subtitle?.trim();
	if (!subtitle) return title;
	if (/[:.?]$/.test(title)) return `${title} ${subtitle}`;
	return `${title}: ${subtitle}`;
}

function formatBook(data: ChicagoInput, title: string): string | undefined {
	const author = formatAuthorList(data.by);
	if (!author && !data.year) return undefined;

	const parts: string[] = [];
	if (author) parts.push(ensurePeriod(author));
	parts.push(ensurePeriod(title));
	const pub = publicationClause(data.place, data.publisher, data.year);
	if (pub) parts.push(pub);
	else if (data.year) parts.push(ensurePeriod(String(data.year)));
	appendDoiOrUrl(parts, data);
	return joinParts(parts);
}

function formatEssay(data: ChicagoInput, title: string): string | undefined {
	const author = formatAuthorList(data.by);
	if (!author) return undefined;

	const parts: string[] = [ensurePeriod(author), `“${title}.”`];
	const container = data.container?.trim();
	if (container) {
		let loc = container;
		const volIssue = volumeIssue(data.volume, data.issue);
		if (volIssue) loc += ` ${volIssue}`;
		if (data.year) loc += ` (${data.year})`;
		if (data.pages?.trim()) loc += `: ${data.pages.trim()}`;
		parts.push(ensurePeriod(loc));
	} else {
		const pub = publicationClause(data.place, data.publisher, data.year);
		if (pub) parts.push(pub);
		else if (data.year) parts.push(ensurePeriod(String(data.year)));
	}
	appendDoiOrUrl(parts, data);
	return joinParts(parts);
}

function formatFilm(data: ChicagoInput, title: string): string | undefined {
	const author = formatAuthorList(data.by);
	const parts: string[] = [];
	if (author) parts.push(`${author.replace(/\.$/, '')}, dir.`);
	parts.push(ensurePeriod(title));
	const pub = publicationClause(data.place, data.publisher, data.year);
	if (pub) parts.push(pub);
	else if (data.year) parts.push(ensurePeriod(String(data.year)));
	appendDoiOrUrl(parts, data);
	if (parts.length < 2) return undefined;
	return joinParts(parts);
}

function formatGeneric(data: ChicagoInput, title: string): string | undefined {
	const author = formatAuthorList(data.by);
	const parts: string[] = [];
	if (author) parts.push(ensurePeriod(author));
	parts.push(ensurePeriod(title));
	const pub = publicationClause(data.place, data.publisher, data.year);
	if (pub) parts.push(pub);
	else if (data.year) parts.push(ensurePeriod(String(data.year)));
	appendDoiOrUrl(parts, data);
	if (!author && !data.year && !data.doi && !data.url) return undefined;
	return joinParts(parts);
}

/** "Last, First" for the first name; "First Last" for the rest; join with ", and ". */
export function formatAuthorList(by?: string): string | undefined {
	const raw = by?.trim();
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

function invertName(name: string): string {
	if (name.includes(',')) return name.replace(/\s+,/, ',').trim();
	const tokens = name.split(/\s+/).filter(Boolean);
	if (tokens.length < 2) return name;
	const last = tokens[tokens.length - 1];
	const given = tokens.slice(0, -1).join(' ');
	return `${last}, ${given}`;
}

/** Chicago: Place: Publisher, Year. */
function publicationClause(
	place?: string,
	publisher?: string,
	year?: string,
): string | undefined {
	const p = place?.trim();
	const pub = publisher?.trim();
	const y = year?.trim();
	if (!pub && !p) return y ? `${y}.` : undefined;
	if (p && pub && y) return `${p}: ${pub}, ${y}.`;
	if (pub && y) return `${pub}, ${y}.`;
	if (p && pub) return `${p}: ${pub}.`;
	if (pub) return `${pub}.`;
	if (p && y) return `${p}, ${y}.`;
	return y ? `${y}.` : undefined;
}

function volumeIssue(volume?: string, issue?: string): string {
	const v = volume?.trim();
	const iss = issue?.trim();
	if (v && iss) return `${v}, no. ${iss}`;
	if (v) return v;
	if (iss) return `no. ${iss}`;
	return '';
}

function appendDoiOrUrl(parts: string[], data: ChicagoInput): void {
	const doi = data.doi?.trim().replace(/^https?:\/\/doi\.org\//i, '');
	if (doi) {
		parts.push(ensurePeriod(`https://doi.org/${doi}`));
		return;
	}
	// Web / archive items without a print container need a stable URL.
	const url = data.url?.trim();
	const type = data.type;
	if (
		url &&
		(type === 'archive' || type === 'other' || (type === 'essay' && !data.container?.trim()))
	) {
		parts.push(ensurePeriod(url));
	}
}

function ensurePeriod(s: string): string {
	const t = s.trim();
	if (!t) return t;
	return /[.!?]$/.test(t) ? t : `${t}.`;
}

function joinParts(parts: string[]): string {
	return parts
		.join(' ')
		.replace(/\s+/g, ' ')
		.replace(/\s+\./g, '.')
		.trim();
}
