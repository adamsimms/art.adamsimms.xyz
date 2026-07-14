#!/usr/bin/env node
/**
 * Assemble the Cloudberry static archive into art Pages dist.
 *
 * Expects pinchards.is at ../pinchards.is (local) or PINCHARDS_REPO_PATH.
 * Builds dist-archive if missing (requires PHP), then copies into
 * dist/cloudberry/archive/ and merges redirect fragment into public/_redirects.
 *
 * Usage (from art.adamsimms.xyz):
 *   node scripts/assemble-cloudberry-archive.mjs
 *   npm run build && node scripts/assemble-cloudberry-archive.mjs
 */

import {
	cpSync,
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
	rmSync,
	readdirSync,
	statSync,
} from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildUmamiScriptTag, loadAnalyticsConfig } from './analytics.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ART_ROOT = resolve(__dirname, '..');
const PINCHARDS =
	process.env.PINCHARDS_REPO_PATH || resolve(ART_ROOT, '../pinchards.is');
const ARCHIVE_SRC = join(PINCHARDS, 'dist-archive');
const ARCHIVE_DEST = join(ART_ROOT, 'dist', 'cloudberry', 'archive');
const FRAGMENT = join(ARCHIVE_SRC, '_redirects.fragment');
const PUBLIC_REDIRECTS = join(ART_ROOT, 'public', '_redirects');
const DIST_REDIRECTS = join(ART_ROOT, 'dist', '_redirects');
const UMAMI_MARKER_START = '<!-- umami-analytics:start -->';
const UMAMI_MARKER_END = '<!-- umami-analytics:end -->';

function fail(msg) {
	console.error(`assemble-cloudberry-archive: ${msg}`);
	process.exit(1);
}

function walkHtmlFiles(dir, out = []) {
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

function injectUmamiIntoArchive(archiveDir) {
	const config = loadAnalyticsConfig(ART_ROOT);
	const tag = buildUmamiScriptTag(config);
	if (!tag) {
		console.warn(
			'assemble-cloudberry-archive: Umami skipped (set UMAMI_WEBSITE_ID or analytics.config.json)',
		);
		return 0;
	}
	const snippet = `    ${UMAMI_MARKER_START}\n    ${tag}\n    ${UMAMI_MARKER_END}\n`;
	let count = 0;
	for (const file of walkHtmlFiles(archiveDir)) {
		let html = readFileSync(file, 'utf8');
		if (html.includes(UMAMI_MARKER_START)) {
			html = html.replace(
				new RegExp(
					`${UMAMI_MARKER_START}[\\s\\S]*?${UMAMI_MARKER_END}\\n?`,
					'g',
				),
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
	console.log(`Injected Umami into ${count} archive HTML file(s)`);
	return count;
}

if (!existsSync(PINCHARDS)) {
	fail(`pinchards repo not found at ${PINCHARDS}`);
}

function ensurePinchardsVendor() {
	const bootstrap = join(PINCHARDS, 'vendor/bootstrap/css/bootstrap.css');
	const gsap = join(PINCHARDS, 'vendor/gsap/gsap.min.js');
	if (existsSync(bootstrap) && existsSync(gsap)) {
		return;
	}
	console.log(
		'assemble-cloudberry-archive: pinchards vendor/ missing — npm ci && npm run vendor:frontend…',
	);
	const npmCi = spawnSync('npm', ['ci'], {
		cwd: PINCHARDS,
		stdio: 'inherit',
		env: process.env,
	});
	if (npmCi.status !== 0) {
		fail('npm ci failed in pinchards repo (needed for Bootstrap/GSAP)');
	}
	const vendor = spawnSync('npm', ['run', 'vendor:frontend'], {
		cwd: PINCHARDS,
		stdio: 'inherit',
		env: process.env,
	});
	if (vendor.status !== 0) {
		fail('npm run vendor:frontend failed in pinchards repo');
	}
	if (!existsSync(bootstrap) || !existsSync(gsap)) {
		fail('vendor assets still missing after vendor:frontend');
	}
}

ensurePinchardsVendor();

const archiveHasVendor =
	existsSync(join(ARCHIVE_SRC, 'vendor/bootstrap/css/bootstrap.css')) &&
	existsSync(join(ARCHIVE_SRC, 'vendor/gsap/gsap.min.js'));

if (!existsSync(join(ARCHIVE_SRC, 'index.html')) || !archiveHasVendor) {
	if (existsSync(join(ARCHIVE_SRC, 'index.html')) && !archiveHasVendor) {
		console.log(
			'assemble-cloudberry-archive: dist-archive missing vendor — rebuilding…',
		);
		rmSync(ARCHIVE_SRC, { recursive: true, force: true });
	} else {
		console.log(
			'dist-archive missing — running php scripts/build-static-archive.php…',
		);
	}
	const build = spawnSync('php', ['scripts/build-static-archive.php'], {
		cwd: PINCHARDS,
		stdio: 'inherit',
		env: process.env,
	});
	if (build.status !== 0) {
		fail('static archive build failed');
	}
}

if (!existsSync(join(ARCHIVE_SRC, 'index.html'))) {
	fail(`no index.html in ${ARCHIVE_SRC}`);
}

const distRoot = join(ART_ROOT, 'dist');
if (!existsSync(distRoot)) {
	fail('art dist/ missing — run `npm run build` first');
}

rmSync(ARCHIVE_DEST, { recursive: true, force: true });
mkdirSync(dirname(ARCHIVE_DEST), { recursive: true });
cpSync(ARCHIVE_SRC, ARCHIVE_DEST, { recursive: true });

// Drop fragment from published archive tree (merged into site redirects instead).
const destFragment = join(ARCHIVE_DEST, '_redirects.fragment');
if (existsSync(destFragment)) {
	rmSync(destFragment);
}

injectUmamiIntoArchive(ARCHIVE_DEST);

if (existsSync(FRAGMENT)) {
	const fragment = readFileSync(FRAGMENT, 'utf8').trim();
	const mergeInto = existsSync(DIST_REDIRECTS) ? DIST_REDIRECTS : PUBLIC_REDIRECTS;
	let existing = existsSync(mergeInto) ? readFileSync(mergeInto, 'utf8') : '';
	const marker = '# cloudberry-archive-redirects';
	if (existing.includes(marker)) {
		existing = existing.replace(
			new RegExp(`${marker}[\\s\\S]*?(?=\\n# |$)`),
			'',
		);
	}
	const merged =
		existing.trimEnd() +
		'\n\n' +
		marker +
		'\n' +
		fragment +
		'\n';
	writeFileSync(mergeInto, merged);
	console.log(`Merged archive redirects into ${mergeInto}`);
}

console.log(`Assembled Cloudberry archive → ${ARCHIVE_DEST}`);
