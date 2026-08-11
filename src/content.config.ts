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

export const collections = { work, blog, pages, writing, research };
