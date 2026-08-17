import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildGhostpaneTag, buildUmamiScriptTag, loadAnalyticsConfig } from './analytics.mjs';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const config = loadAnalyticsConfig(rootDir);

function replaceMarkedBlock(html, relativePath, markerStart, markerEnd, inner) {
	if (!html.includes(markerStart) || !html.includes(markerEnd)) {
		throw new Error(`Missing ${markerStart.trim()} in ${relativePath}`);
	}

	const block = inner
		? `${markerStart}\n\t\t${inner}\n${markerEnd}`
		: `${markerStart}\n${markerEnd}`;

	return html.replace(new RegExp(`${markerStart}[\\s\\S]*?${markerEnd}`), block);
}

const umamiTag = buildUmamiScriptTag(config);
const ghostpaneTag = buildGhostpaneTag(config);
const umamiStart = '\t\t<!-- umami-analytics:start -->';
const umamiEnd = '\t\t<!-- umami-analytics:end -->';
const ghostpaneStart = '\t\t<!-- ghostpane-analytics:start -->';
const ghostpaneEnd = '\t\t<!-- ghostpane-analytics:end -->';
const targets = ['src/layouts/Base.astro'];

for (const relativePath of targets) {
	const filePath = path.join(rootDir, relativePath);
	let html = fs.readFileSync(filePath, 'utf8');
	html = replaceMarkedBlock(html, relativePath, umamiStart, umamiEnd, umamiTag);
	html = replaceMarkedBlock(html, relativePath, ghostpaneStart, ghostpaneEnd, ghostpaneTag);
	fs.writeFileSync(filePath, html);
}

if (config.umamiWebsiteId) {
	console.log(`Umami analytics synced to ${targets.join(', ')}`);
} else {
	console.warn(
		'Umami analytics skipped: set umamiWebsiteId in analytics.config.json or UMAMI_WEBSITE_ID',
	);
}

if (config.ghostpaneSiteId) {
	console.log(`Ghostpane analytics synced to ${targets.join(', ')}`);
} else {
	console.warn(
		'Ghostpane analytics skipped: set ghostpaneSiteId in analytics.config.json or GHOSTPANE_SITE_ID',
	);
}
