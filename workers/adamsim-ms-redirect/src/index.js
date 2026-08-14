/**
 * adamsim.ms → art.adamsimms.xyz permanent redirects.
 * Mirrors public/_redirects aliases, then preserves remaining paths.
 */
const ART = 'https://art.adamsimms.xyz';

/** @type {{ match: RegExp, to: (m: RegExpMatchArray, url: URL) => string }[]} */
const RULES = [
	{ match: /^\/(?:home|intro)\/?$/i, to: () => `${ART}/` },
	{ match: /^\/resume\/?$/i, to: () => `${ART}/cv` },
	{ match: /^\/work\/?$/i, to: () => `${ART}/works` },
	{ match: /^\/work-with-me\/?$/i, to: () => `${ART}/collaborations` },
	{ match: /^\/blog(?:\/.*)?$/i, to: () => `${ART}/` },
	{ match: /^\/new-gallery-1\/?$/i, to: () => `${ART}/works` },
	{ match: /^\/sublime\/?$/i, to: () => `${ART}/barrens` },
];

export default {
	async fetch(request) {
		const url = new URL(request.url);
		const path = url.pathname;

		for (const rule of RULES) {
			const m = path.match(rule.match);
			if (!m) continue;
			const target = new URL(rule.to(m, url));
			target.search = url.search;
			return Response.redirect(target.toString(), 301);
		}

		const target = new URL(`${ART}${path === '/' ? '/' : path}`);
		target.search = url.search;
		return Response.redirect(target.toString(), 301);
	},
};
