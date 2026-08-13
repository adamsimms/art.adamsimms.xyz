/**
 * Build 1280w JPEG "view" derivatives for the Cloudberry archive viewer.
 * Uploads to R2: art-adamsimms-xyz-cloudberry-images/view/<FILENAME>
 *
 * Usage (Node ≥22):
 *   node scripts/generate-cloudberry-view.mjs
 *   node scripts/generate-cloudberry-view.mjs --limit=20
 *   node scripts/generate-cloudberry-view.mjs --concurrency=4
 *
 * Catalog: ../pinchards.is/data/catalog.json (or PINCHARDS_REPO_PATH).
 */
import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ART_ROOT = path.resolve(__dirname, '..');
const PINCHARDS =
	process.env.PINCHARDS_REPO_PATH || path.resolve(ART_ROOT, '../pinchards.is');
const CDN_FULL = 'https://cloudberry-images.adamsimms.xyz/';
const BUCKET = 'art-adamsimms-xyz-cloudberry-images';
const VIEW_PREFIX = 'view/';
const VIEW_WIDTH = 1280;
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

const args = process.argv.slice(2);
const limitArg = args.find((a) => a.startsWith('--limit='));
const concurrencyArg = args.find((a) => a.startsWith('--concurrency='));
const LIMIT = limitArg ? Number(limitArg.split('=')[1]) : 0;
const CONCURRENCY = Math.max(1, Number(concurrencyArg?.split('=')[1] || 4));
const SKIP_EXISTING = !args.includes('--force');

async function loadFilenames() {
	const catalogPath = path.join(PINCHARDS, 'data', 'catalog.json');
	const raw = JSON.parse(await fs.readFile(catalogPath, 'utf8'));
	const photos = Array.isArray(raw.photos) ? raw.photos : [];
	return photos.map((p) => String(p.filename || p.file || '')).filter(Boolean);
}

async function objectExists(key) {
	const url = `${CDN_FULL}${key}`;
	try {
		const res = await fetch(url, { method: 'HEAD' });
		return res.ok;
	} catch {
		return false;
	}
}

async function downloadTo(filePath, url) {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
	await pipeline(Readable.fromWeb(res.body), createWriteStream(filePath));
}

function putObject(key, filePath) {
	execSync(
		`npx wrangler r2 object put ${BUCKET}/${key} --remote --file="${filePath}" --content-type=image/jpeg --cache-control="${CACHE_CONTROL}"`,
		{ stdio: 'pipe' },
	);
}

async function processOne(filename, tmpDir, index, total) {
	const key = `${VIEW_PREFIX}${filename}`;
	if (SKIP_EXISTING && (await objectExists(key))) {
		console.log(`[${index}/${total}] skip (exists) ${filename}`);
		return 'skip';
	}

	const fullPath = path.join(tmpDir, `full-${index}.jpg`);
	const viewPath = path.join(tmpDir, `view-${index}.jpg`);
	const sourceUrl = `${CDN_FULL}${filename}`;

	await downloadTo(fullPath, sourceUrl);
	await sharp(fullPath)
		.rotate()
		.resize({ width: VIEW_WIDTH, withoutEnlargement: true })
		.jpeg({ quality: 72, mozjpeg: true, progressive: true })
		.toFile(viewPath);

	putObject(key, viewPath);
	await Promise.all([fs.unlink(fullPath).catch(() => {}), fs.unlink(viewPath).catch(() => {})]);
	console.log(`[${index}/${total}] ok ${filename}`);
	return 'ok';
}

async function mapPool(items, concurrency, worker) {
	let i = 0;
	const runners = Array.from({ length: concurrency }, async () => {
		while (i < items.length) {
			const idx = i++;
			await worker(items[idx], idx);
		}
	});
	await Promise.all(runners);
}

async function main() {
	let filenames = await loadFilenames();
	if (LIMIT > 0) filenames = filenames.slice(-LIMIT); // prefer latest (default LCP)
	console.log(`Cloudberry view derivatives: ${filenames.length} files, concurrency=${CONCURRENCY}`);

	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cloudberry-view-'));
	let ok = 0;
	let skip = 0;
	let fail = 0;

	await mapPool(filenames, CONCURRENCY, async (filename, idx) => {
		try {
			const result = await processOne(filename, tmpDir, idx + 1, filenames.length);
			if (result === 'skip') skip++;
			else ok++;
		} catch (error) {
			fail++;
			console.error(`[${idx + 1}/${filenames.length}] FAIL ${filename}: ${error.message || error}`);
		}
	});

	console.log(`Done. ok=${ok} skip=${skip} fail=${fail}`);
	console.log(`Public URL pattern: ${CDN_FULL}${VIEW_PREFIX}<FILENAME>`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
