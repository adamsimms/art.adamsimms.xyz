/**
 * Frontmatter + body helpers for research markdown.
 */

/**
 * @param {string} title
 * @returns {string}
 */
export function slugify(title) {
	return String(title || 'untitled')
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 80) || 'untitled';
}

/**
 * @param {Record<string, unknown>} data
 * @param {string} [body]
 */
export function serializeResearchMarkdown(data, body = '') {
	const lines = ['---'];
	const order = [
		'title',
		'slug',
		'type',
		'url',
		'archivedUrl',
		'archivedAt',
		'tags',
		'collections',
		'by',
		'year',
		'subtitle',
		'place',
		'publisher',
		'doi',
		'container',
		'volume',
		'issue',
		'pages',
		'citation',
		'ref',
		'status',
		'collected',
		'quote',
		'private',
		'image',
		'imageAlt',
		'attachments',
		'summary',
		'relatedResearch',
		'relatedWorks',
		'relatedWriting',
	];

	for (const key of order) {
		if (data[key] === undefined || data[key] === null || data[key] === '') continue;
		lines.push(yamlLine(key, data[key]));
	}
	lines.push('---', '');
	const trimmed = String(body || '').trim();
	if (trimmed) lines.push(trimmed, '');
	return lines.join('\n');
}

/**
 * @param {string} raw
 * @returns {{ data: Record<string, unknown>, body: string }}
 */
export function parseResearchMarkdown(raw) {
	const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
	if (!m) return { data: {}, body: raw };
	const data = parseSimpleYaml(m[1]);
	return { data, body: (m[2] || '').trim() };
}

/**
 * Very small YAML subset for our frontmatter (no nested objects except attachments arrays of maps).
 * @param {string} yaml
 */
function parseSimpleYaml(yaml) {
	/** @type {Record<string, unknown>} */
	const data = {};
	const lines = yaml.split(/\r?\n/);
	let i = 0;
	while (i < lines.length) {
		const line = lines[i];
		const att = line.match(/^attachments:\s*$/);
		if (att) {
			const items = [];
			i += 1;
			let current = null;
			while (i < lines.length && /^\s+-/.test(lines[i]) || (current && /^\s+\w/.test(lines[i]))) {
				const l = lines[i];
				const start = l.match(/^\s+-\s+(\w+):\s*(.*)$/);
				if (start) {
					current = {};
					current[start[1]] = unquote(start[2]);
					items.push(current);
				} else if (current) {
					const kv = l.match(/^\s+(\w+):\s*(.*)$/);
					if (kv) current[kv[1]] = unquote(kv[2]);
				}
				i += 1;
			}
			data.attachments = items;
			continue;
		}

		const arr = line.match(/^(\w+):\s*\[(.*)\]\s*$/);
		if (arr) {
			data[arr[1]] = arr[2]
				.split(',')
				.map((s) => unquote(s.trim()))
				.filter(Boolean);
			i += 1;
			continue;
		}

		const kv = line.match(/^(\w+):\s*(.*)$/);
		if (kv) {
			const v = kv[2].trim();
			if (v === 'true') data[kv[1]] = true;
			else if (v === 'false') data[kv[1]] = false;
			else data[kv[1]] = unquote(v);
		}
		i += 1;
	}
	return data;
}

/**
 * @param {string} key
 * @param {unknown} value
 */
function yamlLine(key, value) {
	if (Array.isArray(value)) {
		if (key === 'attachments') {
			if (!value.length) return 'attachments: []';
			const parts = ['attachments:'];
			for (const item of value) {
				if (!item || typeof item !== 'object') continue;
				const obj = /** @type {Record<string, unknown>} */ (item);
				const keys = Object.keys(obj);
				if (!keys.length) continue;
				parts.push(`  - ${keys[0]}: ${yamlScalar(obj[keys[0]])}`);
				for (const k of keys.slice(1)) {
					parts.push(`    ${k}: ${yamlScalar(obj[k])}`);
				}
			}
			return parts.join('\n');
		}
		return `${key}: [${value.map((v) => yamlScalar(v)).join(', ')}]`;
	}
	if (typeof value === 'boolean') return `${key}: ${value}`;
	return `${key}: ${yamlScalar(value)}`;
}

/**
 * @param {unknown} v
 */
function yamlScalar(v) {
	const s = String(v ?? '');
	if (/^[\w.@/+#: -]+$/.test(s) && !s.includes(': ') && s !== '') {
		if (s.includes(' ') || s.includes(':') || s.includes('#')) return JSON.stringify(s);
		return s;
	}
	return JSON.stringify(s);
}

/**
 * @param {string} s
 */
function unquote(s) {
	const t = s.trim();
	if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
		try {
			return JSON.parse(t.replace(/^'/, '"').replace(/'$/, '"'));
		} catch {
			return t.slice(1, -1);
		}
	}
	return t;
}

/**
 * Extract url field from raw markdown frontmatter quickly.
 * @param {string} raw
 * @returns {string | null}
 */
export function extractUrlFromMarkdown(raw) {
	const m = raw.match(/^url:\s*(.+)$/m);
	if (!m) return null;
	return unquote(m[1]);
}

/**
 * @param {string} url
 */
export function normalizeUrl(url) {
	try {
		const u = new URL(url.trim());
		u.hash = '';
		u.hostname = u.hostname.toLowerCase();
		let path = u.pathname.replace(/\/+$/, '') || '/';
		u.pathname = path;
		return u.toString();
	} catch {
		return url.trim().toLowerCase();
	}
}
