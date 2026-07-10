import fs from 'node:fs/promises';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { STAGING_DIR } from './shared.mjs';

const CONTENT_TYPES = {
	'.avif': 'image/avif',
	'.jpg': 'image/jpeg',
	'.jpeg': 'image/jpeg',
	'.webp': 'image/webp',
};

async function walk(dir) {
	const entries = await fs.readdir(dir, { withFileTypes: true });
	const files = [];
	for (const entry of entries) {
		const fullPath = path.join(dir, entry.name);
		if (entry.isDirectory()) {
			files.push(...(await walk(fullPath)));
		} else {
			files.push(fullPath);
		}
	}
	return files;
}

async function main() {
	const files = await walk(STAGING_DIR);
	if (!files.length) {
		console.error('No staged images found. Run npm run migrate:images first.');
		process.exit(1);
	}

	for (const file of files) {
		const key = path.relative(STAGING_DIR, file).replace(/\\/g, '/');
		const ext = path.extname(file).toLowerCase();
		const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';
		console.log(`Uploading ${key} (${contentType})...`);
		execSync(
			`npx wrangler r2 object put adamsimms-xyz-art/${key} --remote --file="${file}" --content-type=${contentType}`,
			{ stdio: 'inherit' },
		);
	}

	console.log(`Uploaded ${files.length} files to R2.`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
