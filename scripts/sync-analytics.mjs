import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildUmamiScriptTag, loadAnalyticsConfig } from './analytics.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = loadAnalyticsConfig(rootDir);
const scriptTag = buildUmamiScriptTag(config);
const markerStart = '\t\t<!-- umami-analytics:start -->';
const markerEnd = '\t\t<!-- umami-analytics:end -->';
const block = scriptTag ? `${markerStart}\n\t\t${scriptTag}\n\t\t${markerEnd}` : `${markerStart}\n\t\t${markerEnd}`;

const targets = ['src/layouts/Base.astro'];

for (const relativePath of targets) {
	const filePath = path.join(rootDir, relativePath);
	let html = fs.readFileSync(filePath, 'utf8');

	if (!html.includes(markerStart) || !html.includes(markerEnd)) {
		throw new Error(`Missing Umami markers in ${relativePath}`);
	}

	html = html.replace(new RegExp(`${markerStart}[\\s\\S]*?${markerEnd}`), block);
	fs.writeFileSync(filePath, html);
}

if (config.umamiWebsiteId) {
	console.log(`Umami analytics synced to ${targets.join(', ')}`);
} else {
	console.warn('Umami analytics skipped: set umamiWebsiteId in analytics.config.json or UMAMI_WEBSITE_ID');
}
