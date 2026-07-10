import fs from 'node:fs/promises';
import path from 'node:path';
import { INVENTORY_PATH, MANIFEST_PATH, ROOT, WORK_SLUGS } from './shared.mjs';

async function main() {
	const inventory = JSON.parse(await fs.readFile(INVENTORY_PATH, 'utf8'));
	const manifest = JSON.parse(await fs.readFile(MANIFEST_PATH, 'utf8'));

	let errors = 0;

	for (const slug of WORK_SLUGS) {
		const workEntry = inventory.work.find((w) => w.slug === slug);
		const manifestEntry = manifest.work[slug];
		const mdPath = path.join(ROOT, 'src/content/work', `${slug}.md`);
		const jsonPath = path.join(ROOT, 'src/content/work', `${slug}.json`);

		if (!workEntry) {
			console.error(`Missing inventory entry: ${slug}`);
			errors++;
			continue;
		}

		try {
			await fs.access(mdPath);
			await fs.access(jsonPath);
		} catch {
			console.error(`Missing content files for: ${slug}`);
			errors++;
		}

		if (!manifestEntry) {
			console.error(`Missing manifest entry: ${slug}`);
			errors++;
			continue;
		}

		const uniqueCount = [...new Map(workEntry.images.map((img) => [img.url, img])).values()].length;
		if (manifestEntry.imageCount !== uniqueCount) {
			console.error(
				`${slug}: image count mismatch (manifest ${manifestEntry.imageCount}, expected ${uniqueCount})`,
			);
			errors++;
		} else {
			console.log(`OK ${slug}: ${manifestEntry.imageCount} images`);
		}
	}

	if (errors) {
		console.error(`Validation failed with ${errors} error(s).`);
		process.exit(1);
	}

	console.log('Validation passed.');
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
