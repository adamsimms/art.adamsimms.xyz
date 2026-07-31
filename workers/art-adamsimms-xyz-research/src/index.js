import PostalMime from 'postal-mime';
import { runEnrichPipeline, log as enrichLog } from '../../shared/research-enrich/index.js';
import {
	DEFAULT_ALLOWLIST,
	MAX_ATTACHMENT_BYTES,
	MAX_BODY_TEXT,
	MAX_RAW_BYTES,
	MAX_SUBJECT_LENGTH,
} from './constants.js';
import { sanitizeFilename } from './fetch-safe.js';
import { extractUrls, normalizeUrl, pickPrimaryUrl } from './urls.js';

/**
 * @typedef {object} Env
 * @property {R2Bucket} RESEARCH
 * @property {Queue} [ENRICH_QUEUE]
 * @property {Ai} [AI]
 * @property {string} [ALLOWLIST]
 */

export default {
	/**
	 * @param {ForwardableEmailMessage} message
	 * @param {Env} env
	 * @param {ExecutionContext} ctx
	 */
	async email(message, env, ctx) {
		const allowlist = parseAllowlist(env.ALLOWLIST);
		const envelopeFrom = (message.from || '').toLowerCase().trim();

		if (!allowlist.includes(envelopeFrom)) {
			log('reject', { reason: 'allowlist', from: envelopeFrom });
			message.setReject('Sender not allowlisted');
			return;
		}

		if (message.rawSize > MAX_RAW_BYTES) {
			log('reject', { reason: 'too_large', size: message.rawSize });
			message.setReject('Message too large');
			return;
		}

		const subjectHeader = message.headers.get('subject') || '';
		if (subjectHeader.length > MAX_SUBJECT_LENGTH) {
			log('reject', { reason: 'subject_too_long' });
			message.setReject('Invalid subject');
			return;
		}

		const buffer = await new Response(message.raw).arrayBuffer();
		const parsed = await PostalMime.parse(buffer);

		const messageId = (parsed.messageId || message.headers.get('message-id') || '').trim();
		if (!messageId) {
			log('reject', { reason: 'missing_message_id' });
			message.setReject('Missing Message-ID');
			return;
		}

		const midHash = await sha256Hex(messageId.toLowerCase());
		const midKey = `inbox/by-message-id/${midHash}.json`;
		const existingMid = await env.RESEARCH.get(midKey);
		if (existingMid) {
			log('dedupe_hit', { kind: 'message-id', messageId });
			return;
		}

		const collectedAt = new Date().toISOString();
		const day = collectedAt.slice(0, 10).replace(/-/g, '/');
		const id = await shortId(messageId, collectedAt);
		const prefix = `inbox/${day}/${id}`;

		const bodyText = (parsed.text || stripHtml(parsed.html || '')).trim();
		const urlsRaw = [
			...extractUrls(subjectHeader),
			...extractUrls(bodyText),
			...extractUrls(parsed.html || ''),
		];
		const primaryUrl = pickPrimaryUrl(urlsRaw);
		const urls = uniqueNormalized(urlsRaw);

		/** @type {string | undefined} */
		let duplicateUrlOf;
		if (primaryUrl) {
			const urlHash = await sha256Hex(normalizeUrl(primaryUrl));
			const urlPointer = await env.RESEARCH.get(`inbox/by-url/${urlHash}.json`);
			if (urlPointer) {
				try {
					const prev = await urlPointer.json();
					duplicateUrlOf = prev.id;
					log('dedupe_hit', { kind: 'url', url: primaryUrl, duplicateUrlOf });
				} catch {
					/* ignore */
				}
			}
		}

		const attachmentMeta = [];
		let attachIndex = 0;
		for (const att of parsed.attachments || []) {
			const filename = sanitizeFilename(att.filename || `attachment-${attachIndex}`);
			const contentType = att.mimeType || 'application/octet-stream';
			const content = att.content;
			const size = content?.byteLength ?? 0;
			const key = `${prefix}/attachments/${attachIndex}-${filename}`;

			if (!content || size === 0) {
				attachmentMeta.push({
					key,
					filename,
					contentType,
					size: 0,
					kind: kindFromType(contentType),
					source: 'email',
					stored: false,
					reason: 'empty',
				});
			} else if (size > MAX_ATTACHMENT_BYTES) {
				attachmentMeta.push({
					key,
					filename,
					contentType,
					size,
					kind: kindFromType(contentType),
					source: 'email',
					stored: false,
					reason: 'too_large',
				});
			} else {
				await env.RESEARCH.put(key, content, {
					httpMetadata: { contentType },
				});
				attachmentMeta.push({
					key,
					filename,
					contentType,
					size,
					kind: kindFromType(contentType),
					source: 'email',
					stored: true,
				});
			}
			attachIndex += 1;
		}

		const hasFile =
			attachmentMeta.some((a) => a.stored) || Boolean(primaryUrl);

		/** @type {Record<string, unknown>} */
		const meta = {
			id,
			status: 'inbox',
			collectedAt,
			from: envelopeFrom,
			to: message.to,
			subject: parsed.subject || subjectHeader || '',
			messageId,
			text: truncate(bodyText, MAX_BODY_TEXT),
			urls,
			primaryUrl: primaryUrl || null,
			attachments: attachmentMeta,
			notes: '',
			prefix,
			...(duplicateUrlOf ? { duplicateUrlOf } : {}),
			enrichment: hasFile || bodyText
				? { status: 'queued', generation: 0 }
				: { status: 'skipped', reason: 'empty' },
		};

		await env.RESEARCH.put(`${prefix}/raw.eml`, buffer, {
			httpMetadata: { contentType: 'message/rfc822' },
		});
		await putMeta(env, prefix, meta);
		await env.RESEARCH.put(
			midKey,
			JSON.stringify({ id, prefix, messageId, collectedAt }),
			{ httpMetadata: { contentType: 'application/json' } },
		);

		if (primaryUrl && !duplicateUrlOf) {
			const urlHash = await sha256Hex(normalizeUrl(primaryUrl));
			await env.RESEARCH.put(
				`inbox/by-url/${urlHash}.json`,
				JSON.stringify({ id, prefix, url: normalizeUrl(primaryUrl), collectedAt }),
				{ httpMetadata: { contentType: 'application/json' } },
			);
		}

		log('accept', { id, prefix, from: envelopeFrom, primaryUrl, attachments: attachmentMeta.length });

		if (meta.enrichment?.status === 'queued') {
			ctx.waitUntil(
				enqueueEnrich(env, { id, prefix, generation: 1 }).catch((err) => {
					log('enrich_enqueue_fail', {
						id,
						error: err instanceof Error ? err.message : String(err),
					});
				}),
			);
		}
	},

	/**
	 * Queue consumer — deep enrichment pipeline.
	 * @param {MessageBatch} batch
	 * @param {Env} env
	 */
	async queue(batch, env) {
		for (const msg of batch.messages) {
			/** @type {{ id?: string, prefix?: string, force?: boolean, forceArchive?: boolean, primaryUrlOverride?: string, generation?: number }} */
			let body;
			try {
				body = typeof msg.body === 'string' ? JSON.parse(msg.body) : msg.body;
			} catch {
				msg.retry();
				continue;
			}

			const prefix = body.prefix;
			const id = body.id;
			if (!prefix || !id) {
				msg.ack();
				continue;
			}

			try {
				const obj = await env.RESEARCH.get(`${prefix}/meta.json`);
				if (!obj) {
					log('enrich_fail', { id, reason: 'meta_missing' });
					msg.ack();
					continue;
				}
				const meta = await obj.json();
				await runEnrichPipeline(env, meta, {
					force: Boolean(body.force),
					forceArchive: Boolean(body.forceArchive),
					primaryUrlOverride: body.primaryUrlOverride,
					generation: body.generation,
				});
				msg.ack();
			} catch (err) {
				enrichLog('enrich_fail', {
					id,
					error: err instanceof Error ? err.message : String(err),
				});
				// Mark failed on last attempts — still retry for transient errors
				try {
					const obj = await env.RESEARCH.get(`${prefix}/meta.json`);
					if (obj) {
						const meta = await obj.json();
						const attempts = Number(msg.attempts || 1);
						if (attempts >= 3) {
							meta.enrichment = {
								...(meta.enrichment || {}),
								status: 'failed',
								reason: 'queue_exhausted',
								error: err instanceof Error ? err.message : String(err),
							};
							await putMeta(env, prefix, meta);
							msg.ack();
							continue;
						}
					}
				} catch {
					/* ignore */
				}
				msg.retry();
			}
		}
	},
};

/**
 * @param {Env} env
 * @param {{ id: string, prefix: string, generation?: number, force?: boolean, forceArchive?: boolean, primaryUrlOverride?: string }} payload
 */
export async function enqueueEnrich(env, payload) {
	if (!env.ENRICH_QUEUE) {
		// Fallback: run inline if queue not bound (local)
		const obj = await env.RESEARCH.get(`${payload.prefix}/meta.json`);
		if (!obj) throw new Error('meta_missing');
		const meta = await obj.json();
		await runEnrichPipeline(env, meta, payload);
		return;
	}
	await env.ENRICH_QUEUE.send(payload);
	log('enrich_queued', { id: payload.id, prefix: payload.prefix });
}

/**
 * @param {Env} env
 * @param {string} prefix
 * @param {Record<string, unknown>} meta
 */
async function putMeta(env, prefix, meta) {
	await env.RESEARCH.put(`${prefix}/meta.json`, JSON.stringify(meta, null, 2), {
		httpMetadata: { contentType: 'application/json' },
	});
}

/** @param {string | undefined} raw */
function parseAllowlist(raw) {
	const list = (raw || DEFAULT_ALLOWLIST.join(','))
		.split(',')
		.map((s) => s.trim().toLowerCase())
		.filter(Boolean);
	return list.length ? list : DEFAULT_ALLOWLIST;
}

/** @param {string[]} urls */
function uniqueNormalized(urls) {
	const seen = new Set();
	const out = [];
	for (const u of urls) {
		const n = normalizeUrl(u);
		if (seen.has(n)) continue;
		seen.add(n);
		out.push(n);
	}
	return out;
}

/** @param {string} html */
function stripHtml(html) {
	return html
		.replace(/<script[\s\S]*?<\/script>/gi, ' ')
		.replace(/<style[\s\S]*?<\/style>/gi, ' ')
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ');
}

/** @param {string} s @param {number} max */
function truncate(s, max) {
	if (s.length <= max) return s;
	return `${s.slice(0, max)}…`;
}

/** @param {string} contentType */
function kindFromType(contentType) {
	const base = (contentType || '').split(';')[0].trim().toLowerCase();
	if (base === 'application/pdf') return 'pdf';
	if (base.startsWith('image/')) return 'image';
	return 'other';
}

/** @param {string} messageId @param {string} collectedAt */
async function shortId(messageId, collectedAt) {
	const hex = await sha256Hex(`${messageId}|${collectedAt}`);
	return hex.slice(0, 12);
}

/** @param {string} value */
async function sha256Hex(value) {
	const data = new TextEncoder().encode(value);
	const digest = await crypto.subtle.digest('SHA-256', data);
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** @param {string} event @param {Record<string, unknown>} fields */
function log(event, fields) {
	console.log(JSON.stringify({ event, ...fields }));
}
