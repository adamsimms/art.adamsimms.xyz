import { parseResearchMarkdown } from './markdown.js';
import { getRepoFile, listResearchFiles } from './github.js';
import {
	writeLibraryIndex,
	writeSiteIndexes,
} from '../../shared/research-enrich/index.js';

/**
 * Rebuild library + works + writing indexes on R2 from GitHub.
 * @param {import('./github.js').Env} env
 */
export async function rebuildAllIndexes(env) {
	const library = await buildLibraryIndex(env);
	const works = await buildWorksIndex(env);
	const writing = await buildWritingIndex(env);
	await writeLibraryIndex(env.RESEARCH, library);
	await writeSiteIndexes(env.RESEARCH, works, writing);
	return { library: library.length, works: works.length, writing: writing.length };
}

/**
 * @param {import('./github.js').Env} env
 */
async function buildLibraryIndex(env) {
	const files = await listResearchFiles(env);
	const entries = [];
	for (const f of files) {
		const slug = f.name.replace(/\.md$/, '');
		const file = await getRepoFile(env, f.path);
		if (!file) continue;
		const { data } = parseResearchMarkdown(file.content);
		entries.push({
			slug,
			title: String(data.title || slug),
			type: String(data.type || ''),
			tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
			collections: Array.isArray(data.collections) ? data.collections.map(String) : [],
			url: data.url ? String(data.url) : undefined,
			by: data.by ? String(data.by) : undefined,
		});
	}
	return entries;
}

/**
 * @param {import('./github.js').Env} env
 */
async function buildWorksIndex(env) {
	const res = await ghList(env, 'contents/src/content/work');
	if (!Array.isArray(res)) return [];
	const entries = [];
	for (const f of res) {
		if (f.type !== 'file' || !f.name.endsWith('.json')) continue;
		const file = await getRepoFile(env, f.path);
		if (!file) continue;
		try {
			const data = JSON.parse(file.content);
			const slug = f.name.replace(/\.json$/, '');
			entries.push({
				slug: data.slug || slug,
				title: String(data.title || slug),
				tags: Array.isArray(data.tags)
					? data.tags.map(String)
					: Array.isArray(data.themes)
						? data.themes.map(String)
						: [],
				year: data.year ? String(data.year) : undefined,
			});
		} catch {
			/* skip */
		}
	}
	return entries;
}

/**
 * @param {import('./github.js').Env} env
 */
async function buildWritingIndex(env) {
	const res = await ghList(env, 'contents/src/content/writing');
	if (!Array.isArray(res)) return [];
	const entries = [];
	for (const f of res) {
		if (f.type !== 'file' || !f.name.endsWith('.md') || f.name.startsWith('_')) continue;
		const file = await getRepoFile(env, f.path);
		if (!file) continue;
		const { data } = parseResearchMarkdown(file.content);
		const slug = f.name.replace(/\.md$/, '');
		entries.push({
			slug: String(data.slug || slug),
			title: String(data.title || slug),
			tags: Array.isArray(data.tags) ? data.tags.map(String) : [],
			year: data.year ? String(data.year) : undefined,
		});
	}
	return entries;
}

/**
 * @param {import('./github.js').Env} env
 * @param {string} pathSuffix
 */
async function ghList(env, pathSuffix) {
	const token = env.GITHUB_TOKEN;
	if (!token) return [];
	const owner = env.GITHUB_OWNER || 'adamsimms';
	const repo = env.GITHUB_REPO || 'art.adamsimms.xyz';
	const url = `https://api.github.com/repos/${owner}/${repo}/${pathSuffix}`;
	const res = await fetch(url, {
		headers: {
			Accept: 'application/vnd.github+json',
			Authorization: `Bearer ${token}`,
			'X-GitHub-Api-Version': '2022-11-28',
			'User-Agent': 'art-adamsimms-xyz-research-admin',
		},
	});
	if (res.status === 404) return [];
	if (!res.ok) return [];
	return res.json();
}
