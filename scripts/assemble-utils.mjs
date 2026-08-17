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
import {
	buildGhostpaneScripts,
	buildUmamiScriptTag,
	GHOSTPANE_MARKER_END,
	GHOSTPANE_MARKER_START,
	loadAnalyticsConfig,
} from './analytics.mjs';

export const UMAMI_MARKER_START = '<!-- umami-analytics:start -->';
export const UMAMI_MARKER_END = '<!-- umami-analytics:end -->';
export { GHOSTPANE_MARKER_START, GHOSTPANE_MARKER_END };

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

function injectMarkedSnippet(html, start, end, inner) {
	if (!inner) {
		return html;
	}
	const snippet = `    ${start}\n    ${inner}\n    ${end}\n`;
	if (html.includes(start)) {
		return html.replace(new RegExp(`${start}[\\s\\S]*?${end}\\n?`, 'g'), snippet);
	}
	if (html.includes('</head>')) {
		return html.replace('</head>', `${snippet}</head>`);
	}
	return html;
}

export function injectUmamiIntoHtmlDir(artRoot, targetDir, label) {
	const config = loadAnalyticsConfig(artRoot);
	const umamiTag = buildUmamiScriptTag(config);
	const ghostpaneScripts = buildGhostpaneScripts(config);
	if (!umamiTag && !ghostpaneScripts) {
		console.warn(
			`${label}: analytics skipped (set website IDs in analytics.config.json)`,
		);
		return 0;
	}

	let count = 0;
	for (const file of walkHtmlFiles(targetDir)) {
		let html = readFileSync(file, 'utf8');
		const original = html;
		html = injectMarkedSnippet(html, UMAMI_MARKER_START, UMAMI_MARKER_END, umamiTag);
		html = injectMarkedSnippet(
			html,
			GHOSTPANE_MARKER_START,
			GHOSTPANE_MARKER_END,
			ghostpaneScripts,
		);
		if (html === original) {
			continue;
		}
		writeFileSync(file, html);
		count += 1;
	}
	console.log(`${label}: injected analytics into ${count} HTML file(s)`);
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
