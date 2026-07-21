#!/usr/bin/env node
/**
 * Assemble Dreamberry public window into art Pages dist at /dreamberry/.
 *
 * Expects ../dreamberry or DREAMBERRY_REPO_PATH. Copies the static `window/`
 * bundle verbatim (portfolio + /window + /info) — no build step in that repo.
 *
 * Usage (from art.adamsimms.xyz, after `npm run build`):
 *   node scripts/assemble-dreamberry.mjs
 *   npm run assemble:dreamberry
 */
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
	ensureDir,
	ensureDist,
	injectUmamiIntoHtmlDir,
} from './assemble-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ART_ROOT = resolve(__dirname, '..');
const DREAMBERRY =
	process.env.DREAMBERRY_REPO_PATH || resolve(ART_ROOT, '../dreamberry');
const SRC = join(DREAMBERRY, 'window');
const DEST = join(ART_ROOT, 'dist', 'dreamberry');

function fail(msg) {
	console.error(`assemble-dreamberry: ${msg}`);
	process.exit(1);
}

if (!existsSync(join(SRC, 'index.html'))) {
	fail(
		`dreamberry window bundle not found at ${SRC} (need window/index.html)`,
	);
}
if (!existsSync(join(SRC, 'window', 'index.html'))) {
	fail(`missing live window page at ${join(SRC, 'window/index.html')}`);
}
if (!existsSync(join(SRC, 'info', 'index.html'))) {
	fail(`missing info page at ${join(SRC, 'info/index.html')}`);
}

ensureDist(ART_ROOT);
rmSync(DEST, { recursive: true, force: true });
ensureDir(DEST);

cpSync(SRC, DEST, { recursive: true });

injectUmamiIntoHtmlDir(ART_ROOT, DEST, 'assemble-dreamberry');
console.log(`Assembled Dreamberry → ${DEST}`);
