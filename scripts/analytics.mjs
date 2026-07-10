import fs from 'node:fs';
import path from 'node:path';

export const UMAMI_SCRIPT_URL = 'https://cloud.umami.is/script.js';
export const UMAMI_DOMAINS = 'adamsimms.xyz,syllabi.adamsimms.xyz,art.adamsimms.xyz';

export function loadAnalyticsConfig(rootDir) {
	const configPath = path.join(rootDir, 'analytics.config.json');
	const defaults = {
		umamiWebsiteId: '',
		umamiScriptUrl: UMAMI_SCRIPT_URL,
		domains: UMAMI_DOMAINS,
	};

	let file = defaults;
	if (fs.existsSync(configPath)) {
		file = { ...defaults, ...JSON.parse(fs.readFileSync(configPath, 'utf8')) };
	}

	return {
		umamiWebsiteId: process.env.UMAMI_WEBSITE_ID || file.umamiWebsiteId || '',
		umamiScriptUrl: file.umamiScriptUrl || UMAMI_SCRIPT_URL,
		domains: file.domains || UMAMI_DOMAINS,
	};
}

export function buildUmamiScriptTag(config) {
	if (!config.umamiWebsiteId) {
		return '';
	}

	return `<script defer src="${config.umamiScriptUrl}" data-website-id="${config.umamiWebsiteId}" data-domains="${config.domains}" data-do-not-track="true"></script>`;
}
