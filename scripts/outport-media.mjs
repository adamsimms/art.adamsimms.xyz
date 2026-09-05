#!/usr/bin/env node
/**
 * Encode Outport inbox media and upload to R2.
 *
 * Input:  _inbox/outport/<slug>/  (images, video, optional audio bed)
 * Output: media.adamsimms.xyz/work/outport/<slug>/
 *
 * Usage:
 *   node scripts/outport-media.mjs [slug]
 *   node scripts/outport-media.mjs            # all slugs in _inbox/outport/
 *
 * Requires: sharp, ffmpeg (for video + audio)
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const INBOX_ROOT = path.join(ROOT, '_inbox/outport');
const MEDIA_BASE = 'https://media.adamsimms.xyz';
const R2_PREFIX = 'work/outport';
const BUCKET = 'art-adamsimms-xyz';
const CACHE_CONTROL = 'public, max-age=31536000, immutable';
const STILL_MAX = 2000;
const VIDEO_MAX = 1920;

const STILL_EXT = new Set(['.jpg', '.jpeg', '.png', '.webp', '.tif', '.tiff', '.heic', '.heif', '.avif']);
const VIDEO_EXT = new Set(['.mov', '.mp4', '.m4v']);
const AUDIO_EXT = new Set(['.m4a', '.wav', '.aac', '.mp3']);

function hasFfmpeg() {
	const result = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
	return result.status === 0;
}

function contentTypeFor(filePath) {
	const ext = path.extname(filePath).toLowerCase();
	if (ext === '.avif') return 'image/avif';
	if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
	if (ext === '.mp4') return 'video/mp4';
	if (ext === '.m4a') return 'audio/mp4';
	return 'application/octet-stream';
}

function putObject(key, filePath) {
	const ct = contentTypeFor(filePath);
	console.log(`  put ${key} (${ct})`);
	execSync(
		`npx wrangler r2 object put ${BUCKET}/${key} --remote --file="${filePath}" --content-type=${ct} --cache-control="${CACHE_CONTROL}"`,
		{ stdio: 'inherit' },
	);
}

function runFfmpeg(args) {
	execSync(['ffmpeg', '-y', ...args].map((part) => `"${part}"`).join(' '), {
		stdio: 'inherit',
		shell: true,
	});
}

async function listSlugs() {
	try {
		const entries = await fs.readdir(INBOX_ROOT, { withFileTypes: true });
		return entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
	} catch (error) {
		if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
			return [];
		}
		throw error;
	}
}

async function encodeStill(inputPath, stem, slug, tmpDir) {
	const avifPath = path.join(tmpDir, `${stem}.avif`);
	const jpgPath = path.join(tmpDir, `${stem}.jpg`);
	const image = sharp(inputPath).rotate().resize({
		width: STILL_MAX,
		height: STILL_MAX,
		fit: 'inside',
		withoutEnlargement: true,
	});
	await image.clone().avif({ quality: 65, effort: 5 }).toFile(avifPath);
	await image.clone().jpeg({ quality: 85, mozjpeg: true }).toFile(jpgPath);
	const meta = await sharp(jpgPath).metadata();
	const width = meta.width ?? STILL_MAX;
	const height = meta.height ?? STILL_MAX;
	const baseKey = `${R2_PREFIX}/${slug}/${stem}`;
	putObject(`${baseKey}.avif`, avifPath);
	putObject(`${baseKey}.jpg`, jpgPath);
	return {
		kind: 'image',
		stem,
		width,
		height,
		src: `${MEDIA_BASE}/${baseKey}.avif`,
		fallback: `${MEDIA_BASE}/${baseKey}.jpg`,
	};
}

async function encodeVideo(inputPath, stem, slug, tmpDir) {
	const mp4Path = path.join(tmpDir, `${stem}.mp4`);
	const posterPath = path.join(tmpDir, `${stem}.jpg`);
	runFfmpeg([
		'-i',
		inputPath,
		'-vf',
		`scale='min(${VIDEO_MAX},iw)':-2`,
		'-c:v',
		'libx264',
		'-preset',
		'slow',
		'-crf',
		'23',
		'-movflags',
		'+faststart',
		'-an',
		mp4Path,
	]);
	runFfmpeg(['-i', inputPath, '-ss', '00:00:00', '-vframes', '1', '-q:v', '2', posterPath]);
	const posterMeta = await sharp(posterPath).metadata();
	const width = posterMeta.width ?? VIDEO_MAX;
	const height = posterMeta.height ?? Math.round((VIDEO_MAX * 9) / 16);
	const baseKey = `${R2_PREFIX}/${slug}/${stem}`;
	putObject(`${baseKey}.mp4`, mp4Path);
	putObject(`${baseKey}.jpg`, posterPath);
	return {
		kind: 'video',
		stem,
		width,
		height,
		src: `${MEDIA_BASE}/${baseKey}.mp4`,
		poster: `${MEDIA_BASE}/${baseKey}.jpg`,
	};
}

async function encodeAudio(inputPath, stem, slug, tmpDir) {
	const m4aPath = path.join(tmpDir, `${stem}.m4a`);
	runFfmpeg(['-i', inputPath, '-c:a', 'aac', '-b:a', '128k', m4aPath]);
	const baseKey = `${R2_PREFIX}/${slug}/${stem}`;
	putObject(`${baseKey}.m4a`, m4aPath);
	return {
		kind: 'audio',
		stem,
		audio: `${MEDIA_BASE}/${baseKey}.m4a`,
	};
}

function printResults(slug, results) {
	console.log(`\nOutport media for ${slug}:\n`);
	for (const item of results) {
		if (item.kind === 'image') {
			console.log(
				`- ${item.stem}: ${item.width}×${item.height}\n  src: ${item.src}\n  fallback: ${item.fallback}`,
			);
		} else if (item.kind === 'video') {
			console.log(
				`- ${item.stem}: ${item.width}×${item.height}\n  src: ${item.src}\n  poster: ${item.poster}`,
			);
		} else if (item.kind === 'audio') {
			console.log(`- ${item.stem} (bed): ${item.audio}`);
		}
	}
	console.log('');
}

async function processSlug(slug) {
	const dir = path.join(INBOX_ROOT, slug);
	const files = (await fs.readdir(dir))
		.filter((name) => !name.startsWith('.'))
		.sort();
	if (!files.length) {
		console.warn(`No files in ${dir}`);
		return;
	}

	const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), `outport-${slug}-`));
	const results = [];

	console.log(`\nProcessing ${slug} (${files.length} file(s))...`);

	for (const name of files) {
		const ext = path.extname(name).toLowerCase();
		const stem = path.basename(name, ext);
		const inputPath = path.join(dir, name);

		if (STILL_EXT.has(ext)) {
			results.push(await encodeStill(inputPath, stem, slug, tmpDir));
			continue;
		}

		if (VIDEO_EXT.has(ext)) {
			if (!hasFfmpeg()) {
				throw new Error('ffmpeg is required for video encode');
			}
			results.push(await encodeVideo(inputPath, stem, slug, tmpDir));
			continue;
		}

		if (AUDIO_EXT.has(ext)) {
			if (!hasFfmpeg()) {
				throw new Error('ffmpeg is required for audio encode');
			}
			results.push(await encodeAudio(inputPath, stem, slug, tmpDir));
			continue;
		}

		console.warn(`  skip ${name} (unsupported type)`);
	}

	printResults(slug, results);
	await fs.rm(tmpDir, { recursive: true, force: true });
}

async function main() {
	const slugArg = process.argv[2];
	const slugs = slugArg ? [slugArg] : await listSlugs();
	if (!slugs.length) {
		console.error(`No inbox folders found under ${INBOX_ROOT}`);
		console.error('Create _inbox/outport/<slug>/ and drop source files there.');
		process.exit(1);
	}

	for (const slug of slugs) {
		await processSlug(slug);
	}
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
