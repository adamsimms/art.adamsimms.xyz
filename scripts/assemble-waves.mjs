#!/usr/bin/env node
/**
 * Assemble Waves into art Pages dist at /waves/.
 * ERDDAP polling is a Pages Function at /waves/call-api (+ /waves/health).
 *
 * Expects ../waves or WAVES_REPO_PATH. Builds a static index via PHP export
 * (default station payload; live data comes from the Function).
 */
import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
	ensureDir,
	ensureDist,
	injectUmamiIntoHtmlDir,
	stripGoogleAnalytics,
} from './assemble-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ART_ROOT = resolve(__dirname, '..');
const WAVES = process.env.WAVES_REPO_PATH || resolve(ART_ROOT, '../waves');
const DEST = join(ART_ROOT, 'dist', 'waves');
const EXPORT_SCRIPT = join(WAVES, 'scripts/export-static.php');

function fail(msg) {
	console.error(`assemble-waves: ${msg}`);
	process.exit(1);
}

if (!existsSync(join(WAVES, 'index.php'))) {
	fail(`waves repo not found (or missing index.php) at ${WAVES}`);
}
if (!existsSync(EXPORT_SCRIPT)) {
	fail(`missing ${EXPORT_SCRIPT}`);
}

ensureDist(ART_ROOT);
rmSync(DEST, { recursive: true, force: true });
ensureDir(DEST);

const exportRun = spawnSync('php', [EXPORT_SCRIPT, `--out=${DEST}`], {
	cwd: WAVES,
	stdio: 'inherit',
	env: {
		...process.env,
		WAVES_SITE_BASE_URL: 'https://art.adamsimms.xyz/waves',
		WAVES_CALL_API_PATH: '/waves/call-api',
	},
});
if (exportRun.status !== 0) {
	fail('scripts/export-static.php failed');
}

cpSync(join(WAVES, 'assets'), join(DEST, 'assets'), { recursive: true });

const pollPath = join(DEST, 'assets/js/station-poll.js');
if (existsSync(pollPath)) {
	let poll = readFileSync(pollPath, 'utf8');
	poll = poll.replace(
		"fetch('call-api.php'",
		"fetch('/waves/call-api'",
	);
	writeFileSync(pollPath, poll);
}

let html = readFileSync(join(DEST, 'index.html'), 'utf8');
html = stripGoogleAnalytics(html);
writeFileSync(join(DEST, 'index.html'), html);

injectUmamiIntoHtmlDir(ART_ROOT, DEST, 'assemble-waves');
console.log(`Assembled Waves → ${DEST}`);
