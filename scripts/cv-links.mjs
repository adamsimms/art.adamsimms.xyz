import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './shared.mjs';

const CV_PATH = path.join(ROOT, 'src/content/pages/cv.md');
const ARCHIVE_PATH = path.join(ROOT, 'src/data/cv-link-archives.json');
const UA =
	'art.adamsimms.xyz cv-link archive (+https://art.adamsimms.xyz/cv)';

const SKIP_ARCHIVE_HOSTS = new Set([
	'www.instagram.com',
	'instagram.com',
	'www.linkedin.com',
	'linkedin.com',
]);

/** Pages to keep in Wayback even if they are not a CV href. */
const EXTRA_URLS = ['https://www.concordia.ca/faculty/adam-simms.html'];

function hostname(url) {
	return new URL(url).hostname.replace(/^www\./, '');
}

function isOwnHost(url) {
	const host = hostname(url);
	return host === 'adamsimms.xyz' || host.endsWith('.adamsimms.xyz');
}

function isAlreadyArchive(url) {
	const host = hostname(url);
	return host === 'archive.org' || host === 'web.archive.org';
}

function extractCvUrls() {
	const md = fs.readFileSync(CV_PATH, 'utf8');
	const urls = [];
	const re = /\]\((https?:[^)\s]+)\)/g;
	let match;
	while ((match = re.exec(md))) {
		const url = match[1];
		if (!urls.includes(url)) urls.push(url);
	}
	for (const url of EXTRA_URLS) {
		if (!urls.includes(url)) urls.push(url);
	}
	return urls;
}

function loadArchive() {
	if (!fs.existsSync(ARCHIVE_PATH)) return { records: {} };
	return JSON.parse(fs.readFileSync(ARCHIVE_PATH, 'utf8'));
}

function saveArchive(data) {
	fs.mkdirSync(path.dirname(ARCHIVE_PATH), { recursive: true });
	fs.writeFileSync(ARCHIVE_PATH, `${JSON.stringify(data, null, '\t')}\n`);
}

function externalLiveUrls() {
	return extractCvUrls().filter((url) => !isOwnHost(url) && !isAlreadyArchive(url));
}

async function fetchWithTimeout(url, options = {}, ms = 20000) {
	const ctrl = new AbortController();
	const timer = setTimeout(() => ctrl.abort(), ms);
	try {
		return await fetch(url, { ...options, signal: ctrl.signal });
	} finally {
		clearTimeout(timer);
	}
}

async function fetchStatus(url) {
	try {
		const res = await fetchWithTimeout(url, {
			method: 'GET',
			redirect: 'follow',
			headers: { 'user-agent': UA },
		});
		return { ok: res.ok, status: res.status, finalUrl: res.url };
	} catch (err) {
		return { ok: false, status: 0, error: err.name === 'AbortError' ? 'timeout' : err.message };
	}
}

async function waybackClosest(url) {
	const api = `https://archive.org/wayback/available?url=${encodeURIComponent(url)}`;
	const res = await fetchWithTimeout(api, { headers: { 'user-agent': UA } });
	if (!res.ok) return null;
	const data = await res.json();
	return data?.archived_snapshots?.closest?.url ?? null;
}

async function savePageNow(url) {
	const saveUrl = `https://web.archive.org/save/${url}`;
	const res = await fetchWithTimeout(
		saveUrl,
		{
			method: 'GET',
			redirect: 'follow',
			headers: { 'user-agent': UA },
		},
		45000,
	);
	const loc =
		res.headers.get('content-location') ||
		res.headers.get('location') ||
		res.url;
	if (loc && loc.includes('/web/')) return loc;
	return waybackClosest(url);
}

function cmd() {
	return process.argv[2] || 'status';
}

async function cmdExtract() {
	for (const url of extractCvUrls()) {
		const tags = [];
		if (isOwnHost(url)) tags.push('own');
		else if (isAlreadyArchive(url)) tags.push('archive');
		else tags.push('external');
		console.log(`${tags.join(',')}\t${url}`);
	}
}

async function cmdArchive() {
	const data = loadArchive();
	data.records ??= {};
	const urls = externalLiveUrls();
	let dirty = false;
	for (const url of urls) {
		const rec = data.records[url] ?? { url };
		if (SKIP_ARCHIVE_HOSTS.has(new URL(url).hostname)) {
			if (!rec.skip) dirty = true;
			rec.skip = 'social-login-wall';
			data.records[url] = rec;
			console.log(`skip\t${url}`);
			continue;
		}
		if (rec.wayback) {
			console.log(`have\t${url}`);
			data.records[url] = rec;
			continue;
		}
		console.log(`save\t${url}`);
		dirty = true;
		data.updated = new Date().toISOString().slice(0, 10);
		try {
			const existing = await waybackClosest(url);
			rec.wayback = existing || (await savePageNow(url));
			rec.saved = data.updated;
			if (!rec.wayback) rec.error = 'no-snapshot';
			else delete rec.error;
		} catch (err) {
			rec.error = err.message;
		}
		data.records[url] = rec;
		saveArchive(data);
		await new Promise((r) => setTimeout(r, 8000));
	}
	if (dirty) saveArchive(data);
	const unrestored = urls.filter((url) => {
		const rec = data.records[url];
		return rec && !rec.skip && !rec.wayback;
	});
	console.log(`archive complete\t${urls.length} urls`);
	if (unrestored.length) {
		console.error(`no snapshot for ${unrestored.length} url(s)`);
		for (const url of unrestored) console.error(`  ${url}`);
	}
}

async function cmdCheck() {
	const data = loadArchive();
	const urls = externalLiveUrls();
	const missing = urls.filter((url) => !data.records?.[url]);
	let dead = 0;
	for (const url of urls) {
		const rec = data.records?.[url];
		if (SKIP_ARCHIVE_HOSTS.has(new URL(url).hostname) || rec?.skip) {
			console.log(`skip\t${url}`);
			continue;
		}
		const result = await fetchStatus(url);
		const row = `${result.status || result.error}\t${url}`;
		if (result.status === 404 || result.status === 410) {
			dead += 1;
			console.log(`DEAD\t${row}${rec?.wayback ? `\t${rec.wayback}` : ''}`);
		} else if (result.status === 0 && rec?.wayback) {
			console.log(`warn\t${row}\t${rec.wayback}`);
		} else if (
			!result.ok &&
			result.status !== 401 &&
			result.status !== 403 &&
			result.status !== 429 &&
			result.status !== 999
		) {
			dead += 1;
			console.log(`DEAD\t${row}${rec?.wayback ? `\t${rec.wayback}` : ''}`);
		} else {
			console.log(`ok\t${row}`);
		}
	}
	if (missing.length) {
		console.error(`sidecar missing ${missing.length} url(s):`);
		for (const url of missing) console.error(`  ${url}`);
	}
	if (dead || missing.length) process.exitCode = 1;
}

const handlers = {
	extract: cmdExtract,
	archive: cmdArchive,
	check: cmdCheck,
	status: cmdExtract,
};

const handler = handlers[cmd()];
if (!handler) {
	console.error('usage: node scripts/cv-links.mjs <extract|archive|check>');
	process.exit(1);
}
await handler();
