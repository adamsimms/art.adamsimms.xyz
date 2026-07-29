import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const work = defineCollection({
	loader: glob({ base: './src/content/work', pattern: '*.md' }),
	schema: z.object({
		title: z.string(),
		slug: z.string(),
		description: z.string().optional(),
		/** Short blurb for meta / Open Graph (≤160 chars). Body copy stays in `description`. */
		seoDescription: z.string().optional(),
		statement: z.string().optional(),
		cover: z.string().optional(),
		coverFallback: z.string().optional(),
		galleryFile: z.string(),
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
		pubDate: z.coerce.date(),
		slug: z.string(),
	}),
});

export const collections = { work, blog, pages, writing };
