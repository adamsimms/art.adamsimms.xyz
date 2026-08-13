/**
 * Resize collaboration gallery images for LCP-friendly display.
 * Writes beside originals: 01-960.jpg, 01-960.avif (max width 960).
 *
 * Usage: node scripts/perf-collaborations.mjs
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const COLLAB_DIR = path.join(ROOT, 'public', 'collaborations');
const MAX_WIDTH = 960;

async function processDir(dir) {
	const entries = await fs.readdir(dir);
	const jpgs = entries.filter((f) => /^\d+\.jpe?g$/i.test(f)).sort();
	for (const file of jpgs) {
		const srcPath = path.join(dir, file);
		const base = file.replace(/\.jpe?g$/i, '');
		const outJpg = path.join(dir, `${base}-960.jpg`);
		const outAvif = path.join(dir, `${base}-960.avif`);
		const image = sharp(srcPath).rotate().resize({
			width: MAX_WIDTH,
			withoutEnlargement: true,
		});
		await image.clone().jpeg({ quality: 78, mozjpeg: true }).toFile(outJpg);
		await image.clone().avif({ quality: 55, effort: 5 }).toFile(outAvif);
		const [jpgStat, avifStat, srcStat] = await Promise.all([
			fs.stat(outJpg),
			fs.stat(outAvif),
			fs.stat(srcPath),
		]);
		console.log(
			`  ${path.relative(COLLAB_DIR, srcPath)}: ${(srcStat.size / 1024).toFixed(0)} → jpg ${(jpgStat.size / 1024).toFixed(0)} / avif ${(avifStat.size / 1024).toFixed(0)} KiB`,
		);
	}
}

async function main() {
	const projects = await fs.readdir(COLLAB_DIR);
	for (const project of projects) {
		const dir = path.join(COLLAB_DIR, project);
		const st = await fs.stat(dir);
		if (!st.isDirectory()) continue;
		console.log(project);
		await processDir(dir);
	}
	console.log('Done.');
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
