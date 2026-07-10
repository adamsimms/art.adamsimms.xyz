import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MIGRATION_DIR = path.join(ROOT, 'migration');
export const RAW_DIR = path.join(MIGRATION_DIR, 'raw');
export const STAGING_DIR = path.join(MIGRATION_DIR, 'staging');
export const INVENTORY_PATH = path.join(MIGRATION_DIR, 'inventory.json');
export const MANIFEST_PATH = path.join(MIGRATION_DIR, 'manifest.json');

export const SOURCE_BASE = 'https://adamsim.ms';
export const MEDIA_BASE = 'https://media.adamsimms.xyz';

export const WORK_SLUGS = [
	'sublime',
	'washed-up',
	'from-to',
	'newfoundland',
	'resettlement',
	'pinchards-island',
	'driftwood',
	'cloudberry',
	'cabin',
	'mug-up',
	'light-house',
	'adrift',
	'new-gallery-1',
];

export const BLOG_POSTS = [
	'blog/2014/landscape-and-power',
	'blog/2013/artsida5-auction',
	'blog/2013/artsida-5-exhibition',
];

export const PAGE_PATHS = ['intro', 'about', 'resume', 'blog', 'home', ...WORK_SLUGS, ...BLOG_POSTS];

export function decodeHtml(text = '') {
	return text
		.replace(/&mdash;/g, '—')
		.replace(/&ndash;/g, '–')
		.replace(/&amp;/g, '&')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/\s+/g, ' ')
		.trim();
}

export function slugFromPath(urlPath) {
	return urlPath.replace(/^\/+/, '').replace(/\//g, '--') || 'index';
}

export function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}
