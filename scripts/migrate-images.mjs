import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { INVENTORY_PATH, MANIFEST_PATH, MEDIA_BASE, STAGING_DIR } from './shared.mjs';

function padImageIndex(index) {
	return String(index).padStart(2, '0');
}

async function downloadSource(url) {
	const response = await fetch(url, {
		headers: { 'User-Agent': 'adamsimms-art-migration/1.0' },
	});
	if (!response.ok) {
		throw new Error(`Failed to download ${url}: ${response.status}`);
	}
	return Buffer.from(await response.arrayBuffer());
}

async function writeFormats(buffer, slug, fileIndex) {
	const baseRelative = `work/${slug}/${fileIndex}`;
	const avifRelative = `${baseRelative}.avif`;
	const jpgRelative = `${baseRelative}.jpg`;
	const avifPath = path.join(STAGING_DIR, avifRelative);
	const jpgPath = path.join(STAGING_DIR, jpgRelative);

	await fs.mkdir(path.dirname(avifPath), { recursive: true });

	const image = sharp(buffer);
	await image.clone().avif({ quality: 70, effort: 4 }).toFile(avifPath);
	await image.clone().jpeg({ quality: 88, mozjpeg: true }).toFile(jpgPath);

	const [avifStats, jpgStats] = await Promise.all([fs.stat(avifPath), fs.stat(jpgPath)]);

	return {
		avif: {
			path: avifRelative,
			publicUrl: `${MEDIA_BASE}/${avifRelative}`,
			bytes: avifStats.size,
		},
		jpg: {
			path: jpgRelative,
			publicUrl: `${MEDIA_BASE}/${jpgRelative}`,
			bytes: jpgStats.size,
		},
	};
}

async function main() {
	// Remove previous WebP staging so uploads only send AVIF/JPEG
	await fs.rm(STAGING_DIR, { recursive: true, force: true });
	await fs.mkdir(STAGING_DIR, { recursive: true });

	const inventory = JSON.parse(await fs.readFile(INVENTORY_PATH, 'utf8'));
	const manifest = {
		generatedAt: new Date().toISOString(),
		mediaBase: MEDIA_BASE,
		formats: ['avif', 'jpg'],
		work: {},
	};

	for (const entry of inventory.work) {
		const slug = entry.slug;
		const uniqueImages = [...new Map(entry.images.map((img) => [img.url, img])).values()];
		const images = [];

		for (const [index, image] of uniqueImages.entries()) {
			const fileIndex = padImageIndex(index + 1);
			console.log(`Encoding ${slug} #${fileIndex} (AVIF + JPEG)...`);

			try {
				const buffer = await downloadSource(image.url);
				const formats = await writeFormats(buffer, slug, fileIndex);
				images.push({
					file: fileIndex,
					sourceUrl: image.url,
					avif: formats.avif,
					jpg: formats.jpg,
				});
			} catch (error) {
				console.error(`  Failed: ${error.message}`);
				images.push({ file: fileIndex, sourceUrl: image.url, error: error.message });
			}
		}

		manifest.work[slug] = {
			imageCount: images.filter((img) => !img.error).length,
			expectedCount: uniqueImages.length,
			images,
		};
	}

	await fs.mkdir(path.dirname(MANIFEST_PATH), { recursive: true });
	await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
	console.log(`Wrote ${MANIFEST_PATH}`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
