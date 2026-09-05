import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const work = defineCollection({
	loader: glob({ base: './src/content/work', pattern: '*.md' }),
	schema: z.object({
		title: z.string(),
		slug: z.string(),
		/** Project statement (one or more paragraphs, blank-line separated). */
		description: z.string().optional(),
		/** Optional essay paragraphs shown below media (smaller than the intro). */
		body: z.string().optional(),
		/** Short blurb for meta / Open Graph (≤160 chars). Do not paste the essay into meta. */
		seoDescription: z.string().optional(),
		statement: z.string().optional(),
		cover: z.string().optional(),
		coverFallback: z.string().optional(),
		galleryFile: z.string(),
		/**
		 * When true with a video, hero shows video only; gallery stills render
		 * as a stack below the essay instead of in the hero carousel.
		 */
		stillsAfterBody: z.boolean().optional(),
		order: z.number(),
		year: z.string().optional(),
		medium: z.string().optional(),
		video: z
			.object({
				provider: z.string(),
				id: z.string(),
				/** Duration in seconds */
				duration: z.number().optional(),
				/** When true, display "Loop" instead of a duration */
				loop: z.boolean().optional(),
				/** Optional poster; falls back to cover when omitted */
				poster: z.string().optional(),
				posterFallback: z.string().optional(),
			})
			.optional(),
	}),
});

const blog = defineCollection({
	loader: glob({ base: './src/content/blog', pattern: '**/*.md' }),
	schema: z.object({
		title: z.string(),
		description: z.string().optional(),
		pubDate: z.coerce.date(),
		slug: z.string(),
	}),
});

const pages = defineCollection({
	loader: glob({ base: './src/content/pages', pattern: '*.md' }),
	schema: z.object({
		title: z.string(),
		description: z.string().optional(),
		statement: z.string().optional(),
	}),
});

const writing = defineCollection({
	loader: glob({ base: './src/content/writing', pattern: '**/*.md' }),
	schema: z.object({
		title: z.string(),
		/** Optional explicit line breaks for the display title */
		titleLines: z.array(z.string()).optional(),
		subtitle: z.string().optional(),
		description: z.string().optional(),
		/** Social / Open Graph image (JPG preferred: crawlers often skip AVIF). */
		image: z.string().optional(),
		imageAlt: z.string().optional(),
		pubDate: z.coerce.date(),
		slug: z.string(),
	}),
});

const researchAttachment = z.object({
	url: z.string(),
	kind: z.enum(['pdf', 'image', 'scan', 'other', 'capture']),
	title: z.string().optional(),
});

const research = defineCollection({
	loader: glob({ base: './src/content/research', pattern: '*.md' }),
	schema: z.object({
		title: z.string(),
		/** Stable ID — prefer editing title over renaming slug once linked. */
		slug: z.string(),
		type: z.enum([
			'book',
			'essay',
			'artwork',
			'person',
			'concept',
			'place',
			'archive',
			'film',
			'other',
		]),
		url: z.string().optional(),
		archivedUrl: z.string().optional(),
		archivedAt: z.coerce.date().optional(),
		tags: z.array(z.string()).default([]),
		/** Intentional sets; one file may belong to many collections. */
		collections: z.array(z.string()).default([]),
		by: z.string().optional(),
		year: z.string().optional(),
		/** Bibliographic subtitle (joined as “Title: Subtitle” in Chicago). */
		subtitle: z.string().optional(),
		/** Place of publication (Chicago: before publisher). */
		place: z.string().optional(),
		publisher: z.string().optional(),
		doi: z.string().optional(),
		/** Journal or edited-volume title (essays). */
		container: z.string().optional(),
		volume: z.string().optional(),
		issue: z.string().optional(),
		pages: z.string().optional(),
		/**
		 * Optional hand-tuned Chicago bibliography string.
		 * When omitted, the site generates Chicago from structured fields.
		 */
		citation: z.string().optional(),
		/** Optional external id (e.g. Zotero key) — not used for display. */
		ref: z.string().optional(),
		status: z.enum(['note', 'developed', 'core']).default('note'),
		collected: z.coerce.date(),
		quote: z.string().optional(),
		/** Omit from index, sitemap, and static paths when true. */
		private: z.boolean().default(false),
		image: z.string().optional(),
		imageAlt: z.string().optional(),
		attachments: z.array(researchAttachment).default([]),
		summary: z.string().optional(),
		relatedResearch: z.array(z.string()).default([]),
		relatedWorks: z.array(z.string()).default([]),
		relatedWriting: z.array(z.string()).default([]),
	}),
});

const outportTextStyle = z.enum(['title', 'quote', 'micro', 'small']);
const outportSpaceSize = z.enum(['s', 'm', 'l', 'xl', '2xl', '3xl']);
const outportRowAlign = z.enum(['top', 'bottom']).optional();
const outportTextAlign = z
	.enum([
		'top-left',
		'top',
		'top-right',
		'left',
		'center',
		'right',
		'bottom-left',
		'bottom',
		'bottom-right',
	])
	.optional();

const outportTextCell = z.object({
	type: z.literal('text'),
	span: z.number().int().min(1).max(4),
	style: outportTextStyle.default('small'),
	body: z.string(),
	attrib: z.string().optional(),
	align: outportTextAlign,
	border: z.boolean().optional(),
	background: z.string().optional(),
	color: z.string().optional(),
});

const outportImageCell = z.object({
	type: z.literal('image'),
	span: z.number().int().min(1).max(4),
	src: z.string(),
	fallback: z.string(),
	width: z.number().int().positive(),
	height: z.number().int().positive(),
	alt: z.string(),
	title: z.string().optional(),
	place: z.string().optional(),
	date: z.string().optional(),
	people: z.array(z.string()).optional(),
	cover: z.boolean().optional(),
	caption: z.string().optional(),
	align: outportRowAlign,
});

const outportVideoCell = z.object({
	type: z.literal('video'),
	span: z.number().int().min(1).max(4),
	src: z.string(),
	poster: z.string(),
	width: z.number().int().positive(),
	height: z.number().int().positive(),
	alt: z.string(),
	place: z.string().optional(),
	date: z.string().optional(),
	people: z.array(z.string()).optional(),
	audio: z.string().optional(),
	caption: z.string().optional(),
	align: outportRowAlign,
});

const outportEmptyCell = z.object({
	type: z.literal('empty'),
	span: z.number().int().min(1).max(4),
	align: outportRowAlign,
});

const outportSpaceCell = z.object({
	type: z.literal('space'),
	span: z.literal(4),
	size: outportSpaceSize,
});

const outportCell = z.discriminatedUnion('type', [
	outportTextCell,
	outportImageCell,
	outportVideoCell,
	outportEmptyCell,
	outportSpaceCell,
]);

const outport = defineCollection({
	loader: glob({ base: './src/content/outport', pattern: '*.md' }),
	schema: z.object({
		slug: z.string(),
		date: z.coerce.date(),
		draft: z.boolean().default(false),
		rows: z.array(
			z.object({
				cells: z.array(outportCell).min(1),
			}),
		),
	}),
});

export const collections = { work, blog, pages, writing, research, outport };
