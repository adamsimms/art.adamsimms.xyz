/**
 * Re-upload objects in the portfolio R2 bucket with long Cache-Control.
 *
 * Usage:
 *   node scripts/restamp-r2-cache.mjs              # all keys
 *   node scripts/restamp-r2-cache.mjs work/         # prefix filter
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ACCOUNT_ID = '1bf55fc4d05548d7bf541d845d3bcbb3';
const BUCKET = 'art-adamsimms-xyz';
const CACHE_CONTROL = 'public, max-age=31536000, immutable';
const MEDIA_BASE = 'https://media.adamsimms.xyz';
const PREFIX = process.argv[2] || '';

function readOAuthToken() {
	const configPath = path.join(
		os.homedir(),
		'Library/Preferences/.wrangler/config/default.toml',
	);
	const raw = execSync(`cat "${configPath}"`, { encoding: 'utf8' });
	const match = raw.match(/oauth_token\s*=\s*"([^"]+)"/);
	if (!match) throw new Error('No oauth_token in wrangler config');
	return match[1];
}

function contentTypeFor(key) {
	const ext = path.extname(key).toLowerCase();
	const map = {
		'.avif': 'image/avif',
		'.jpg': 'image/jpeg',
		'.jpeg': 'image/jpeg',
		'.png': 'image/png',
		'.webp': 'image/webp',
		'.mp4': 'video/mp4',
		'.webm': 'video/webm',
		'.svg': 'image/svg+xml',
		'.json': 'application/json',
	};
	return map[ext] || 'application/octet-stream';
}

async function listKeys(token) {
	const keys = [];
	let cursor = undefined;
	for (;;) {
		const url = new URL(
			`https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/r2/buckets/${BUCKET}/objects`,
		);
		url.searchParams.set('per_page', '1000');
		if (PREFIX) url.searchParams.set('prefix', PREFIX);
		if (cursor) url.searchParams.set('cursor', cursor);
		const res = await fetch(url, {
			headers: { Authorization: `Bearer ${token}` },
		});
		const body = await res.json();
		if (!res.ok || !body.success) {
			throw new Error(`List failed: ${JSON.stringify(body.errors || body)}`);
		}
		for (const obj of body.result || []) {
			keys.push(obj.key || obj.name);
		}
		cursor = body.result_info?.cursor || body.result_info?.cursors?.after;
		if (!cursor || !(body.result || []).length) break;
	}
	return keys.filter(Boolean);
}

async function main() {
	const token = readOAuthToken();
	console.log(`Listing objects${PREFIX ? ` with prefix ${PREFIX}` : ''}…`);
	const keys = await listKeys(token);
	console.log(`Found ${keys.length} objects`);

	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'art-r2-restamp-'));
	let done = 0;
	for (const key of keys) {
		done += 1;
		const safe = key.replace(/[^\w.-]+/g, '_');
		const local = path.join(tmpDir, `${done}-${safe}`);
		process.stdout.write(`[${done}/${keys.length}] ${key}\n`);
		const res = await fetch(`${MEDIA_BASE}/${key}`);
		if (!res.ok) {
			console.warn(`  skip download ${res.status}`);
			continue;
		}
		await fs.writeFile(local, Buffer.from(await res.arrayBuffer()));
		const ct = contentTypeFor(key);
		execSync(
			`npx wrangler r2 object put ${BUCKET}/${key} --remote --file="${local}" --content-type=${ct} --cache-control="${CACHE_CONTROL}"`,
			{ stdio: 'inherit' },
		);
		await fs.unlink(local).catch(() => {});
	}
	console.log('Done.');
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
