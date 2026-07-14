/**
 * Phase 5: pinchards.is → art.adamsimms.xyz redirects.
 * Routes: pinchards.is/*, www.pinchards.is/*
 */
const ART = 'https://art.adamsimms.xyz';

/** @type {{ match: RegExp, to: (m: RegExpMatchArray, url: URL) => string }[]} */
const RULES = [
	{ match: /^\/gallery(?:-days)?\.php$/i, to: () => `${ART}/cloudberry/archive/gallery/` },
	{ match: /^\/(?:slideshow|slider)\.php$/i, to: () => `${ART}/cloudberry/archive/` },
	{ match: /^\/info\.php$/i, to: () => `${ART}/cloudberry/archive/info/` },
	{ match: /^\/(?:index\.php)?$/i, to: () => `${ART}/cloudberry/archive/` },
	{ match: /^\/viewer-photo\.php$/i, to: () => `${ART}/cloudberry/archive/` },
	{
		match: /^\/jam(\/.*)?$/i,
		to: (m) => `${ART}/cloudberry/archive/jam${m[1] || '/'}`,
	},
	{ match: /^\/map\/?$/i, to: () => `${ART}/maps` },
	{ match: /^\/maps\/satellite(\/.*)?$/i, to: () => `${ART}/maps` },
	{ match: /^\/maps\/trees(\/.*)?$/i, to: (m) => `${ART}/maps/trees${m[1] || ''}` },
	{ match: /^\/trees\/?$/i, to: () => `${ART}/maps/trees` },
	{ match: /^\/maps\/resettled(\/.*)?$/i, to: (m) => `${ART}/maps/resettled${m[1] || ''}` },
	{ match: /^\/resettled\/?$/i, to: () => `${ART}/maps/resettled` },
	{ match: /^\/maps(\/.*)?$/i, to: (m) => `${ART}/maps${m[1] || ''}` },
	{ match: /^\/adrift\/weather\.php$/i, to: () => `${ART}/adrift/api/weather` },
	{
		match: /^\/adrift(\/.*)?$/i,
		to: (m) => `${ART}/adrift/experience${m[1] || '/'}`,
	},
	{ match: /^\/dory(\/.*)?$/i, to: (m) => `${ART}/dory${m[1] || '/'}` },
	{ match: /^\/waves\/call-api\.php$/i, to: () => `${ART}/waves/call-api` },
	{ match: /^\/waves\/health\.php$/i, to: () => `${ART}/waves/health` },
	{ match: /^\/waves\/wave2?\.php$/i, to: () => `${ART}/waves/` },
	{ match: /^\/waves(\/.*)?$/i, to: (m) => `${ART}/waves${m[1] || '/'}` },
	{
		match: /^\/light-house(\/.*)?$/i,
		to: (m) => `${ART}/light-house/experience${m[1] || '/'}`,
	},
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

		const fallback = new URL(`${ART}/cloudberry/archive/`);
		fallback.search = url.search;
		return Response.redirect(fallback.toString(), 301);
	},
};
