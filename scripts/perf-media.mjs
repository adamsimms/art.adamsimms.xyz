/**
 * Generate hover-sized covers + home hero poster variants, upload to R2
 * with long Cache-Control. Also re-stamps Cache-Control on listed keys.
 *
 * Usage:
 *   node scripts/perf-media.mjs
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execSync } from 'node:child_process';
import sharp from 'sharp';

const MEDIA_BASE = 'https://media.adamsimms.xyz';
const BUCKET = 'art-adamsimms-xyz';
const CACHE_CONTROL = 'public, max-age=31536000, immutable';
const HOVER_MAX = 1280;

const COVERS = [
	'work/mug-up/01',
	'work/pinchards-island/01',
	'work/sublime/01',
	'work/cabin/01',
	'work/cloudberry/01',
	'work/resettlement/01',
	'work/adrift/poster',
	'work/light-house/01',
	'work/driftwood/01',
	'work/newfoundland/01',
	'work/washed-up/01',
	'work/from-to/01',
];

const HERO_POSTER_SRC = 'work/light-house/hero-poster.jpg';

function contentTypeFor(filePath) {
	const ext = path.extname(filePath).toLowerCase();
	if (ext === '.avif') return 'image/avif';
	if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
	if (ext === '.mp4') return 'video/mp4';
	return 'application/octet-stream';
}

async function download(key) {
	const response = await fetch(`${MEDIA_BASE}/${key}`);
	if (!response.ok) throw new Error(`GET ${key} → ${response.status}`);
	return Buffer.from(await response.arrayBuffer());
}

function putObject(key, filePath) {
	const ct = contentTypeFor(filePath);
	console.log(`  put ${key} (${ct})`);
	execSync(
		`npx wrangler r2 object put ${BUCKET}/${key} --remote --file="${filePath}" --content-type=${ct} --cache-control="${CACHE_CONTROL}"`,
		{ stdio: 'inherit' },
	);
}

async function writeHover(baseKey, tmpDir) {
	const srcKey = `${baseKey}.jpg`;
	let buffer;
	try {
		buffer = await download(srcKey);
	} catch {
		buffer = await download(`${baseKey}.avif`);
	}

	const outAvif = path.join(tmpDir, `${path.basename(baseKey)}-hover.avif`);
	const outJpg = path.join(tmpDir, `${path.basename(baseKey)}-hover.jpg`);
	const image = sharp(buffer).rotate().resize({
		width: HOVER_MAX,
		height: HOVER_MAX,
		fit: 'inside',
		withoutEnlargement: true,
	});
	await image.clone().avif({ quality: 55, effort: 5 }).toFile(outAvif);
	await image.clone().jpeg({ quality: 78, mozjpeg: true }).toFile(outJpg);

	const avifKey = `${baseKey}-hover.avif`;
	const jpgKey = `${baseKey}-hover.jpg`;
	putObject(avifKey, outAvif);
	putObject(jpgKey, outJpg);

	const [avifStat, jpgStat] = await Promise.all([fs.stat(outAvif), fs.stat(outJpg)]);
	console.log(`  ${avifKey}: ${(avifStat.size / 1024).toFixed(1)} KiB`);
	console.log(`  ${jpgKey}: ${(jpgStat.size / 1024).toFixed(1)} KiB`);
}

async function writeHeroPosters(tmpDir) {
	const buffer = await download(HERO_POSTER_SRC);
	const fullAvif = path.join(tmpDir, 'hero-poster.avif');
	const mobileJpg = path.join(tmpDir, 'hero-poster-960.jpg');
	const mobileAvif = path.join(tmpDir, 'hero-poster-960.avif');

	await sharp(buffer).avif({ quality: 55, effort: 5 }).toFile(fullAvif);
	const mobile = sharp(buffer).rotate().resize({ width: 960, withoutEnlargement: true });
	await mobile.clone().jpeg({ quality: 78, mozjpeg: true }).toFile(mobileJpg);
	await mobile.clone().avif({ quality: 50, effort: 5 }).toFile(mobileAvif);

	putObject('work/light-house/hero-poster.avif', fullAvif);
	putObject('work/light-house/hero-poster-960.jpg', mobileJpg);
	putObject('work/light-house/hero-poster-960.avif', mobileAvif);

	// Re-stamp Cache-Control on the existing JPG poster + hero videos
	const restamp = path.join(tmpDir, 'hero-poster.jpg');
	await fs.writeFile(restamp, buffer);
	putObject(HERO_POSTER_SRC, restamp);

	for (const video of ['work/light-house/hero-720.mp4', 'work/light-house/hero-1080.mp4']) {
		const local = path.join(tmpDir, path.basename(video));
		const res = await fetch(`${MEDIA_BASE}/${video}`);
		if (!res.ok) {
			console.warn(`  skip ${video}: ${res.status}`);
			continue;
		}
		await fs.writeFile(local, Buffer.from(await res.arrayBuffer()));
		putObject(video, local);
	}
}

async function main() {
	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'art-perf-media-'));
	console.log(`Working in ${tmpDir}`);

	for (const cover of COVERS) {
		console.log(`\nHover cover ${cover}`);
		try {
			await writeHover(cover, tmpDir);
		} catch (error) {
			console.error(`  failed: ${error.message || error}`);
		}
	}

	console.log('\nHero posters + cache restamp');
	await writeHeroPosters(tmpDir);

	console.log('\nDone.');
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
