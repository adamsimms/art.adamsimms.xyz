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
