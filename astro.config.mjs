// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { isExcludedFromSitemap } from './src/lib/seo.ts';

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
					return !isExcludedFromSitemap(path);
				} catch {
					return true;
				}
			},
		}),
	],
});
