/**
 * Shared helpers for sibling assemble scripts.
 */
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { buildUmamiScriptTag, loadAnalyticsConfig } from './analytics.mjs';

export const UMAMI_MARKER_START = '<!-- umami-analytics:start -->';
export const UMAMI_MARKER_END = '<!-- umami-analytics:end -->';

export function walkHtmlFiles(dir, out = []) {
	for (const name of readdirSync(dir)) {
		const full = join(dir, name);
		const st = statSync(full);
		if (st.isDirectory()) {
			walkHtmlFiles(full, out);
		} else if (name.endsWith('.html')) {
			out.push(full);
		}
	}
	return out;
}

export function injectUmamiIntoHtmlDir(artRoot, targetDir, label) {
	const config = loadAnalyticsConfig(artRoot);
	const tag = buildUmamiScriptTag(config);
	if (!tag) {
		console.warn(`${label}: Umami skipped (set UMAMI_WEBSITE_ID or analytics.config.json)`);
		return 0;
	}
	const snippet = `    ${UMAMI_MARKER_START}\n    ${tag}\n    ${UMAMI_MARKER_END}\n`;
	let count = 0;
	for (const file of walkHtmlFiles(targetDir)) {
		let html = readFileSync(file, 'utf8');
		if (html.includes(UMAMI_MARKER_START)) {
			html = html.replace(
				new RegExp(`${UMAMI_MARKER_START}[\\s\\S]*?${UMAMI_MARKER_END}\\n?`, 'g'),
				snippet,
			);
		} else if (html.includes('</head>')) {
			html = html.replace('</head>', `${snippet}</head>`);
		} else {
			continue;
		}
		writeFileSync(file, html);
		count += 1;
	}
	console.log(`${label}: injected Umami into ${count} HTML file(s)`);
	return count;
}

export function stripGoogleAnalytics(html) {
	return html
		.replace(
			/<script[^>]*googletagmanager\.com\/gtag\/js[^>]*>\s*<\/script>\s*/gi,
			'',
		)
		.replace(/<script>\s*window\.dataLayer[\s\S]*?gtag\('config'[\s\S]*?<\/script>\s*/gi, '');
}

export function ensureDist(artRoot) {
	const dist = join(artRoot, 'dist');
	if (!existsSync(dist)) {
		throw new Error('art dist/ missing — run `npm run build` first');
	}
	return dist;
}

export function ensureDir(path) {
	mkdirSync(path, { recursive: true });
}
