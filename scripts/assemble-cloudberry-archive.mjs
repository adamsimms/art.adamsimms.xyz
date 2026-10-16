#!/usr/bin/env node
/**
 * Assemble the Cloudberry static archive into art Pages dist.
 *
 * Expects cloudberry-archive at ../cloudberry-archive (local), or
 * CLOUDBERRY_ARCHIVE_REPO_PATH / PINCHARDS_REPO_PATH.
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
} from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { injectUmamiIntoHtmlDir } from './assemble-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ART_ROOT = resolve(__dirname, '..');
const ARCHIVE_REPO =
	process.env.CLOUDBERRY_ARCHIVE_REPO_PATH ||
	process.env.PINCHARDS_REPO_PATH ||
	resolve(ART_ROOT, '../cloudberry-archive');
const ARCHIVE_SRC = join(ARCHIVE_REPO, 'dist-archive');
const ARCHIVE_DEST = join(ART_ROOT, 'dist', 'cloudberry', 'archive');
const FRAGMENT = join(ARCHIVE_SRC, '_redirects.fragment');
const PUBLIC_REDIRECTS = join(ART_ROOT, 'public', '_redirects');
const DIST_REDIRECTS = join(ART_ROOT, 'dist', '_redirects');

function fail(msg) {
	console.error(`assemble-cloudberry-archive: ${msg}`);
	process.exit(1);
}

if (!existsSync(ARCHIVE_REPO)) {
	fail(`cloudberry-archive repo not found at ${ARCHIVE_REPO}`);
}

function ensureArchiveVendor() {
	const bootstrap = join(ARCHIVE_REPO, 'vendor/bootstrap/css/bootstrap.css');
	const gsap = join(ARCHIVE_REPO, 'vendor/gsap/gsap.min.js');
	if (existsSync(bootstrap) && existsSync(gsap)) {
		return;
	}
	console.log(
		'assemble-cloudberry-archive: vendor/ missing — npm ci && npm run vendor:frontend…',
	);
	const npmCi = spawnSync('npm', ['ci'], {
		cwd: ARCHIVE_REPO,
		stdio: 'inherit',
		env: process.env,
	});
	if (npmCi.status !== 0) {
		fail('npm ci failed in cloudberry-archive (needed for Bootstrap/GSAP)');
	}
	const vendor = spawnSync('npm', ['run', 'vendor:frontend'], {
		cwd: ARCHIVE_REPO,
		stdio: 'inherit',
		env: process.env,
	});
	if (vendor.status !== 0) {
		fail('npm run vendor:frontend failed in cloudberry-archive');
	}
	if (!existsSync(bootstrap) || !existsSync(gsap)) {
		fail('vendor assets still missing after vendor:frontend');
	}
}

ensureArchiveVendor();

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
		cwd: ARCHIVE_REPO,
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

injectUmamiIntoHtmlDir(ART_ROOT, ARCHIVE_DEST, 'assemble-cloudberry-archive');

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
