#!/usr/bin/env node
/**
 * Assemble Adrift experience into art Pages dist at /adrift/experience/.
 * Weather API is a Pages Function at /adrift/api/weather.
 *
 * Expects ../adrift or ADRIFT_REPO_PATH.
 */
import {
	cpSync,
	existsSync,
	readFileSync,
	rmSync,
	writeFileSync,
	readdirSync,
	statSync,
} from 'node:fs';
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
const ADRIFT = process.env.ADRIFT_REPO_PATH || resolve(ART_ROOT, '../adrift');
const DEST = join(ART_ROOT, 'dist', 'adrift', 'experience');

const COPY_DIRS = ['css', 'jsm', 'js', '_yh1', 'mp3'];
const COPY_FILES = ['index.html', 'dev.html', 'weather-console.html', 'robots.txt'];

function fail(msg) {
	console.error(`assemble-adrift: ${msg}`);
	process.exit(1);
}

function rewriteWeatherUrls(dir) {
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		const st = statSync(full);
		if (st.isDirectory()) {
			rewriteWeatherUrls(full);
			continue;
		}
		if (!/\.(js|html)$/.test(name)) {
			continue;
		}
		let text = readFileSync(full, 'utf8');
		const next = text
			.replaceAll("fetch('weather.php')", "fetch('/adrift/api/weather')")
			.replaceAll('fetch("weather.php")', 'fetch("/adrift/api/weather")')
			.replaceAll('xhr.open("GET", "weather.php")', 'xhr.open("GET", "/adrift/api/weather")')
			.replaceAll("xhr.open('GET', 'weather.php')", "xhr.open('GET', '/adrift/api/weather')");
		if (next !== text) {
			writeFileSync(full, next);
		}
	}
}

if (!existsSync(join(ADRIFT, 'index.html'))) {
	fail(`adrift repo not found (or missing index.html) at ${ADRIFT}`);
}

ensureDist(ART_ROOT);
rmSync(DEST, { recursive: true, force: true });
ensureDir(DEST);

for (const dir of COPY_DIRS) {
	const src = join(ADRIFT, dir);
	if (existsSync(src)) {
		cpSync(src, join(DEST, dir), { recursive: true });
	}
}
for (const file of COPY_FILES) {
	const src = join(ADRIFT, file);
	if (existsSync(src)) {
		cpSync(src, join(DEST, file));
	}
}

rewriteWeatherUrls(DEST);

const indexPath = join(DEST, 'index.html');
let html = readFileSync(indexPath, 'utf8');
html = stripGoogleAnalytics(html);
const experienceUrl = 'https://art.adamsimms.xyz/adrift/experience/';
if (!html.includes('rel="canonical"')) {
	html = html.replace(
		'</head>',
		`  <link rel="canonical" href="${experienceUrl}">\n</head>`,
	);
} else {
	html = html.replace(
		/href="https?:\/\/[^"]*adrift[^"]*"/i,
		`href="${experienceUrl}"`,
	);
}
html = html.replace(
	/<meta\s+property="og:url"\s+content="[^"]*"/i,
	`<meta property="og:url" content="${experienceUrl}"`,
);
writeFileSync(indexPath, html);

injectUmamiIntoHtmlDir(ART_ROOT, DEST, 'assemble-adrift');
console.log(`Assembled Adrift experience → ${DEST}`);
