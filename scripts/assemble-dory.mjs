#!/usr/bin/env node
/**
 * Assemble Dory (Sketchfab embed) into art Pages dist at /dory/.
 *
 * Expects ../dory or DORY_REPO_PATH.
 */
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	ensureDir,
	ensureDist,
	injectUmamiIntoHtmlDir,
	stripGoogleAnalytics,
} from './assemble-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ART_ROOT = resolve(__dirname, '..');
const DORY = process.env.DORY_REPO_PATH || resolve(ART_ROOT, '../dory');
const DEST = join(ART_ROOT, 'dist', 'dory');

function fail(msg) {
	console.error(`assemble-dory: ${msg}`);
	process.exit(1);
}

if (!existsSync(join(DORY, 'index.html'))) {
	fail(`dory repo not found (or missing index.html) at ${DORY}`);
}

ensureDist(ART_ROOT);
rmSync(DEST, { recursive: true, force: true });
ensureDir(DEST);

cpSync(join(DORY, 'index.html'), join(DEST, 'index.html'));
cpSync(join(DORY, 'css'), join(DEST, 'css'), { recursive: true });
for (const dir of ['images', 'favicon']) {
	const src = join(DORY, dir);
	if (existsSync(src)) {
		cpSync(src, join(DEST, dir), { recursive: true });
	}
}
for (const file of ['robots.txt', 'sitemap.xml']) {
	const src = join(DORY, file);
	if (existsSync(src)) {
		cpSync(src, join(DEST, file));
	}
}

let html = readFileSync(join(DEST, 'index.html'), 'utf8');
html = stripGoogleAnalytics(html);
html = html
	.replaceAll('https://www.pinchards.is/dory/', 'https://art.adamsimms.xyz/dory/')
	.replaceAll('https://www.pinchards.is/', 'https://art.adamsimms.xyz/')
	.replace('<title>Dory</title>', '<title>Dory — Adam Simms</title>');
if (!html.includes('rel="canonical"')) {
	html = html.replace(
		'</head>',
		'  <link rel="canonical" href="https://art.adamsimms.xyz/dory/">\n</head>',
	);
}
writeFileSync(join(DEST, 'index.html'), html);

injectUmamiIntoHtmlDir(ART_ROOT, DEST, 'assemble-dory');
console.log(`Assembled Dory → ${DEST}`);
