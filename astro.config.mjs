// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

const HIDDEN_PATHS = new Set(['/from-to', '/washed-up', '/newfoundland']);

// https://astro.build/config
export default defineConfig({
	site: 'https://art.adamsimms.xyz',
	output: 'static',
	trailingSlash: 'never',
	integrations: [
		sitemap({
			filter: (page) => {
				try {
					const path = new URL(page).pathname.replace(/\/$/, '') || '/';
					return !HIDDEN_PATHS.has(path);
				} catch {
					return true;
				}
			},
		}),
	],
});
