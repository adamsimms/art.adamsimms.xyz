/**
 * Inbox helpers for R2 art-adamsimms-xyz-research.
 */

/**
 * @param {R2Bucket} bucket
 * @param {string} [statusFilter] inbox | deferred | promoted | discarded | all
 */
export async function listInboxItems(bucket, statusFilter = 'inbox') {
	const listed = await bucket.list({ prefix: 'inbox/', limit: 1000 });
	const metaKeys = listed.objects
		.map((o) => o.key)
		.filter((k) => k.endsWith('/meta.json') && !k.includes('/by-'));

	const items = [];
	for (const key of metaKeys) {
		const obj = await bucket.get(key);
		if (!obj) continue;
		try {
			const meta = await obj.json();
			const status = meta.status || 'inbox';
			if (statusFilter !== 'all' && status !== statusFilter) continue;
			items.push({ ...meta, metaKey: key });
		} catch {
			/* skip bad json */
		}
	}

	items.sort((a, b) => String(b.collectedAt || '').localeCompare(String(a.collectedAt || '')));
	return items;
}

/**
 * @param {R2Bucket} bucket
 * @param {string} id
 */
export async function getInboxItem(bucket, id) {
	const items = await listInboxItems(bucket, 'all');
	const hit = items.find((i) => i.id === id);
	if (!hit) return null;
	return hit;
}

/**
 * Next open inbox item after an action (newest remaining).
 * @param {R2Bucket} bucket
 * @param {string} [exceptId]
 * @returns {Promise<string | null>}
 */
export async function nextInboxItemId(bucket, exceptId) {
	const items = await listInboxItems(bucket, 'inbox');
	const next = items.find((i) => i.id !== exceptId);
	return next?.id || null;
}

/**
 * @param {R2Bucket} bucket
 * @param {string} prefix
 * @param {Record<string, unknown>} meta
 */
export async function putMeta(bucket, prefix, meta) {
	await bucket.put(`${prefix}/meta.json`, JSON.stringify(meta, null, 2), {
		httpMetadata: { contentType: 'application/json' },
	});
}

/**
 * Permanently delete an inbox item: all R2 objects under its prefix + pointer keys.
 * Does not touch library markdown or files/<slug>/ copies from a prior promote.
 * @param {R2Bucket} bucket
 * @param {Record<string, unknown>} item
 */
export async function deleteInboxItem(bucket, item) {
	const prefix = String(item.prefix || '');
	if (!prefix.startsWith('inbox/') || prefix.includes('..')) {
		throw new Error('bad_prefix');
	}

	/** @type {string[]} */
	const keys = [];
	let cursor;
	do {
		const listed = await bucket.list({ prefix: `${prefix}/`, cursor, limit: 1000 });
		for (const o of listed.objects) keys.push(o.key);
		cursor = listed.truncated ? listed.cursor : undefined;
	} while (cursor);

	// Also delete the prefix folder marker if any object was stored without trailing slash quirks
	if (!keys.includes(`${prefix}/meta.json`) && item.metaKey) {
		keys.push(String(item.metaKey));
	}

	for (let i = 0; i < keys.length; i += 100) {
		const chunk = keys.slice(i, i + 100);
		await Promise.all(chunk.map((key) => bucket.delete(key)));
	}

	const messageId = String(item.messageId || '').trim();
	if (messageId) {
		const midHash = await sha256Hex(messageId.toLowerCase());
		await bucket.delete(`inbox/by-message-id/${midHash}.json`);
	}

	const primaryUrl = item.primaryUrl ? String(item.primaryUrl) : '';
	if (primaryUrl) {
		const urlHash = await sha256Hex(normalizeUrlLite(primaryUrl));
		const pointerKey = `inbox/by-url/${urlHash}.json`;
		const pointer = await bucket.get(pointerKey);
		if (pointer) {
			try {
				const prev = await pointer.json();
				if (prev.id === item.id) await bucket.delete(pointerKey);
			} catch {
				await bucket.delete(pointerKey);
			}
		}
	}
}

/** @param {string} value */
async function sha256Hex(value) {
	const data = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest('SHA-256', data);
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Lightweight normalize for pointer keys (matches inbox worker enough for deletes). */
function normalizeUrlLite(url) {
	try {
		const u = new URL(url.trim());
		u.hash = '';
		u.hostname = u.hostname.toLowerCase();
		for (const key of [...u.searchParams.keys()]) {
			if (
				key.toLowerCase().startsWith('utm_') ||
				['fbclid', 'gclid', 'mc_cid', 'mc_eid'].includes(key.toLowerCase())
			) {
				u.searchParams.delete(key);
			}
		}
		let path = u.pathname.replace(/\/+$/, '') || '/';
		u.pathname = path;
		return u.toString();
	} catch {
		return url.trim();
	}
}

/**
 * Copy a stored attachment into files/<slug>/…
 * @param {R2Bucket} bucket
 * @param {{ key: string, filename: string, contentType?: string, stored?: boolean }} att
 * @param {string} slug
 * @param {number} index
 */
export async function copyAttachmentToFiles(bucket, att, slug, index) {
	if (!att.stored || !att.key) {
		return { ...att, promotedKey: null, promotedUrl: null, stored: false };
	}
	const safe = String(att.filename || `file-${index}`).replace(/[^\w.\-()+ ]+/g, '_').slice(0, 120);
	const dest = `files/${slug}/${index}-${safe}`;
	const src = await bucket.get(att.key);
	if (!src) {
		return { ...att, promotedKey: null, promotedUrl: null, stored: false, reason: 'missing_source' };
	}
	await bucket.put(dest, src.body, {
		httpMetadata: { contentType: att.contentType || src.httpMetadata?.contentType || 'application/octet-stream' },
	});
	return {
		url: `r2://${dest}`,
		kind: att.kind || 'other',
		title: att.filename,
		key: dest,
		source: att.source,
		stored: true,
	};
}
