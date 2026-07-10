import fs from 'node:fs/promises';
import path from 'node:path';
import { INVENTORY_PATH, MEDIA_BASE, ROOT, WORK_SLUGS } from './shared.mjs';

function yamlEscape(value = '') {
	if (!value) return '""';
	if (/[:#\n"'&>|]/.test(value) || value.startsWith(' ')) {
		return JSON.stringify(value);
	}
	return value;
}

function padImageIndex(index) {
	return String(index).padStart(2, '0');
}

async function writeWork(entry, order) {
	const slug = entry.slug;
	const contentDir = path.join(ROOT, 'src/content/work');
	await fs.mkdir(contentDir, { recursive: true });

	const uniqueImages = [...new Map(entry.images.map((img) => [img.url, img])).values()];
	const galleryImages = uniqueImages.map((image, index) => {
		const fileIndex = padImageIndex(index + 1);
		return {
			src: `${MEDIA_BASE}/work/${slug}/${fileIndex}.avif`,
			fallback: `${MEDIA_BASE}/work/${slug}/${fileIndex}.jpg`,
			alt: entry.title,
			caption: image.caption || '',
			sourceUrl: image.url,
		};
	});

	const cover = galleryImages[0]?.src || '';
	const coverFallback = galleryImages[0]?.fallback || '';
	const galleryFile = `${slug}.json`;

	await fs.writeFile(path.join(contentDir, `${slug}.json`), JSON.stringify({ images: galleryImages }, null, 2));

	const frontmatter = [
		'---',
		`title: ${yamlEscape(entry.title)}`,
		`slug: ${slug}`,
		`description: ${yamlEscape(entry.description)}`,
		`statement: |`,
		...entry.statement.split('\n').map((line) => `  ${line}`),
		`cover: ${yamlEscape(cover)}`,
		`coverFallback: ${yamlEscape(coverFallback)}`,
		`galleryFile: ${galleryFile}`,
		`order: ${order}`,
		'---',
		'',
	].join('\n');

	await fs.writeFile(path.join(contentDir, `${slug}.md`), frontmatter);
}

async function writeBlogPost(entry) {
	const contentDir = path.join(ROOT, 'src/content/blog');
	await fs.mkdir(contentDir, { recursive: true });

	const slug = entry.slug;
	const pubDate = entry.pubDate ? new Date(entry.pubDate).toISOString().slice(0, 10) : '2013-01-01';
	const filename = slug.replace(/\//g, '-') + '.md';

	const frontmatter = [
		'---',
		`title: ${yamlEscape(entry.title)}`,
		`description: ${yamlEscape(entry.description)}`,
		`pubDate: ${pubDate}`,
		`slug: ${slug}`,
		'---',
		'',
		entry.bodyText || entry.description,
	].join('\n');

	await fs.writeFile(path.join(contentDir, filename), frontmatter);
}

async function writePage(key, entry) {
	const contentDir = path.join(ROOT, 'src/content/pages');
	await fs.mkdir(contentDir, { recursive: true });

	const frontmatter = [
		'---',
		`title: ${yamlEscape(entry.title)}`,
		`description: ${yamlEscape(entry.description)}`,
		'---',
		'',
		entry.bodyText || entry.description,
	].join('\n');

	await fs.writeFile(path.join(contentDir, `${key}.md`), frontmatter);

	if (key === 'intro' && entry.workLinks?.length) {
		const homeData = {
			workLinks: entry.workLinks.map((link, index) => ({
				...link,
				order: WORK_SLUGS.indexOf(link.slug) >= 0 ? WORK_SLUGS.indexOf(link.slug) + 1 : index + 1,
			})),
		};
		await fs.writeFile(path.join(contentDir, 'home.json'), JSON.stringify(homeData, null, 2));
	}
}

async function main() {
	const inventory = JSON.parse(await fs.readFile(INVENTORY_PATH, 'utf8'));

	for (const [index, entry] of inventory.work.entries()) {
		await writeWork(entry, index + 1);
		console.log(`Wrote work: ${entry.slug}`);
	}

	for (const entry of inventory.blog) {
		if (entry.type === 'blog-post') {
			await writeBlogPost(entry);
			console.log(`Wrote blog post: ${entry.slug}`);
		}
	}

	if (inventory.home) await writePage('intro', inventory.home);
	if (inventory.about) await writePage('about', inventory.about);
	if (inventory.resume) await writePage('cv', inventory.resume);

	console.log('Content migration complete.');
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
