// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
	site: 'https://art.adamsimms.xyz',
	output: 'static',
	trailingSlash: 'never',
	integrations: [sitemap()],
});
