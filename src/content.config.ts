import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const work = defineCollection({
	loader: glob({ base: './src/content/work', pattern: '*.md' }),
	schema: z.object({
		title: z.string(),
		slug: z.string(),
		/** Short intro shown before media. */
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
		/** Social / Open Graph image (JPG preferred — crawlers often skip AVIF). */
		image: z.string().optional(),
		imageAlt: z.string().optional(),
		pubDate: z.coerce.date(),
		slug: z.string(),
	}),
});

export const collections = { work, blog, pages, writing };
