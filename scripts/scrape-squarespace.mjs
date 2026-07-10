import fs from 'node:fs/promises';
import path from 'node:path';
import * as cheerio from 'cheerio';
import {
	BLOG_POSTS,
	INVENTORY_PATH,
	PAGE_PATHS,
	RAW_DIR,
	SOURCE_BASE,
	WORK_SLUGS,
	decodeHtml,
	slugFromPath,
	sleep,
} from './shared.mjs';

function extractImages(html) {
	const images = [];
	const seen = new Set();

	const addImage = (url, meta = {}) => {
		if (!url || !url.includes('squarespace-cdn.com')) return;
		const normalized = url.split('?')[0];
		if (seen.has(normalized)) return;
		seen.add(normalized);
		images.push({ url: normalized, ...meta });
	};

	for (const match of html.matchAll(/data-image="([^"]+)"/g)) {
		addImage(match[1]);
	}

	for (const match of html.matchAll(/srcset="([^"]+)"/g)) {
		const candidates = match[1]
			.split(',')
			.map((part) => part.trim().split(/\s+/))
			.filter(([url]) => url.includes('squarespace-cdn.com'));
		if (candidates.length) {
			addImage(candidates.at(-1)[0]);
		}
	}

	return images;
}

function extractWorkPage($, html, urlPath) {
	const title = decodeHtml(
		$('meta[property="og:title"]').attr('content')?.split('—')[0]?.trim() ||
			$('title').text().split('—')[0]?.trim(),
	);
	const description = decodeHtml($('meta[name="description"]').attr('content') || '');
	const statement = decodeHtml(
		$('.gallery-description, .page-description, .sqs-block-content').first().text() || description,
	);
	const images = extractImages(html).map((image, index) => ({
		...image,
		filename: path.basename(image.url),
		order: index + 1,
	}));

	return { type: 'work', slug: urlPath, title, description, statement, images };
}

function extractBlogPost($, html, urlPath) {
	const title = decodeHtml(
		$('meta[property="og:title"]').attr('content')?.split('—')[0]?.trim() || $('h1').first().text(),
	);
	const description = decodeHtml($('meta[name="description"]').attr('content') || '');
	const dateText = $('time').first().attr('datetime') || $('time').first().text();
	const bodyText = decodeHtml($('.blog-item-content, .sqs-block-content, article').first().text() || '');

	return {
		type: 'blog-post',
		slug: urlPath.replace(/^blog\//, ''),
		path: `/${urlPath}`,
		title,
		description,
		pubDate: dateText || null,
		bodyText,
		images: extractImages(html),
	};
}

function extractBlogIndex($, html) {
	const posts = [];
	$('article, .blog-list-item, .summary-item').each((_, el) => {
		const link = $(el).find('a[href*="/blog/"]').first().attr('href');
		const title = decodeHtml($(el).find('h1, h2, .summary-title').first().text());
		if (link && title) {
			const normalized = link.replace(SOURCE_BASE, '').replace(/^\//, '').replace(/\/$/, '');
			if (normalized.startsWith('blog/20')) {
				posts.push({ path: `/${normalized}`, title });
			}
		}
	});

	return {
		type: 'blog-index',
		slug: 'blog',
		title: decodeHtml($('title').text().split('—')[0]?.trim() || 'Blog'),
		posts: posts.length ? posts : BLOG_POSTS.map((p) => ({ path: `/${p}`, title: p })),
		images: extractImages(html),
	};
}

function extractPage($, html, urlPath) {
	const title = decodeHtml(
		$('meta[property="og:title"]').attr('content')?.split('—')[0]?.trim() ||
			$('title').text().split('—')[0]?.trim(),
	);
	const description = decodeHtml($('meta[name="description"]').attr('content') || '');
	const bodyText = decodeHtml($('#page, main, .content, .sqs-layout').first().text() || '');
	const images = extractImages(html);

	const workLinks = [];
	$('a[href]').each((_, el) => {
		const href = $(el).attr('href') || '';
		const normalized = href.replace(SOURCE_BASE, '').replace(/^\//, '').replace(/\/$/, '');
		if (WORK_SLUGS.includes(normalized)) {
			workLinks.push({
				slug: normalized,
				title: decodeHtml($(el).text()) || normalized,
				href: `/${normalized}`,
			});
		}
	});

	return {
		type: 'page',
		slug: urlPath || 'intro',
		title,
		description,
		bodyText,
		workLinks: [...new Map(workLinks.map((item) => [item.slug, item])).values()],
		images,
	};
}

async function fetchPage(urlPath) {
	const url = `${SOURCE_BASE}/${urlPath}`;
	const response = await fetch(url, {
		headers: { 'User-Agent': 'adamsimms-art-migration/1.0' },
	});
	if (!response.ok) {
		throw new Error(`Failed to fetch ${url}: ${response.status}`);
	}
	return { url, html: await response.text() };
}

async function scrapePath(urlPath) {
	const { url, html } = await fetchPage(urlPath);
	const fileSlug = slugFromPath(urlPath);
	await fs.mkdir(RAW_DIR, { recursive: true });
	await fs.writeFile(path.join(RAW_DIR, `${fileSlug}.html`), html);

	const $ = cheerio.load(html);
	let entry;

	if (WORK_SLUGS.includes(urlPath)) {
		entry = extractWorkPage($, html, urlPath);
	} else if (BLOG_POSTS.includes(urlPath)) {
		entry = extractBlogPost($, html, urlPath);
	} else if (urlPath === 'blog') {
		entry = extractBlogIndex($, html);
	} else {
		entry = extractPage($, html, urlPath);
	}

	entry.sourceUrl = url;
	entry.scrapedAt = new Date().toISOString();
	return entry;
}

async function main() {
	const inventory = {
		source: SOURCE_BASE,
		scrapedAt: new Date().toISOString(),
		pages: [],
		work: [],
		blog: [],
	};

	for (const urlPath of PAGE_PATHS) {
		console.log(`Scraping /${urlPath}...`);
		const entry = await scrapePath(urlPath);

		inventory.pages.push({
			slug: entry.slug,
			type: entry.type,
			sourceUrl: entry.sourceUrl,
			imageCount: entry.images?.length || 0,
		});

		if (entry.type === 'work') inventory.work.push(entry);
		else if (entry.type === 'blog-post' || entry.type === 'blog-index') inventory.blog.push(entry);
		else if (entry.slug === 'intro') inventory.home = entry;
		else if (entry.slug === 'about') inventory.about = entry;
		else if (entry.slug === 'resume') inventory.resume = entry;

		await sleep(300);
	}

	await fs.mkdir(path.dirname(INVENTORY_PATH), { recursive: true });
	await fs.writeFile(INVENTORY_PATH, JSON.stringify(inventory, null, 2));
	console.log(`Wrote ${INVENTORY_PATH}`);
	console.log(`Work: ${inventory.work.length}, Blog: ${inventory.blog.length}`);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
