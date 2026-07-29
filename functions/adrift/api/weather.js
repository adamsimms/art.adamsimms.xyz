/**
 * Adrift weather proxy — MSC GeoMet → WeatherAPI-shaped current conditions.
 * Route: GET /adrift/api/weather?lat=&lon=
 */

const DEFAULT_LAT = 49.2006;
const DEFAULT_LON = -53.4869;
const GEOMET_BASE = 'https://api.weather.gc.ca';
const CACHE_TTL_SECONDS = 600;

function geometEn(value) {
	if (!value || typeof value !== 'object' || Array.isArray(value)) {
		return value;
	}
	if (Object.prototype.hasOwnProperty.call(value, 'en') && Object.prototype.hasOwnProperty.call(value, 'fr')) {
		return value.en;
	}
	const out = {};
	for (const [k, v] of Object.entries(value)) {
		out[k] = geometEn(v);
	}
	return out;
}

function bbox(lat, lon, pad = 0.2) {
	return `${lon - pad},${lat - pad},${lon + pad},${lat + pad}`;
}

async function fetchJson(url) {
	const res = await fetch(url, {
		headers: {
			Accept: 'application/json',
			'User-Agent': 'adrift (MSC GeoMet; art.adamsimms.xyz/adrift/experience)',
		},
	});
	if (!res.ok) {
		return null;
	}
	return res.json();
}

async function citypage(lat, lon) {
	const url =
		`${GEOMET_BASE}/collections/citypageweather-realtime/items` +
		`?f=json&limit=1&bbox=${encodeURIComponent(bbox(lat, lon))}`;
	const data = await fetchJson(url);
	const props = data?.features?.[0]?.properties;
	return props && typeof props === 'object' ? props : null;
}

function formatLastUpdated(iso) {
	try {
		const dt = iso ? new Date(iso) : new Date();
		return new Intl.DateTimeFormat('en-CA', {
			timeZone: 'America/St_Johns',
			year: 'numeric',
			month: '2-digit',
			day: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
			hour12: false,
		})
			.format(dt)
			.replace(',', '');
	} catch {
		return new Date().toISOString().slice(0, 16).replace('T', ' ');
	}
}

/** Environment Canada icon codes → short footer labels */
const ICON_CONDITION = {
	0: 'Sunny',
	1: 'Sunny',
	2: 'Cloudy',
	3: 'Cloudy',
	4: 'Cloudy',
	5: 'Cloudy',
	6: 'Rain',
	7: 'Rain',
	8: 'Snow',
	9: 'Rain',
	10: 'Cloudy',
	11: 'Rain',
	12: 'Rain',
	13: 'Rain',
	14: 'Rain',
	15: 'Rain',
	16: 'Snow',
	17: 'Snow',
	18: 'Snow',
	19: 'Rain',
	20: 'Fog',
	21: 'Fog',
	22: 'Cloudy',
	23: 'Fog',
	24: 'Fog',
	25: 'Snow',
	26: 'Snow',
	27: 'Snow',
	28: 'Rain',
	30: 'Clear',
	31: 'Clear',
	32: 'Cloudy',
	33: 'Cloudy',
	34: 'Cloudy',
	35: 'Cloudy',
	36: 'Rain',
	37: 'Snow',
	38: 'Snow',
	39: 'Rain',
	40: 'Snow',
	43: 'Windy',
	44: 'Fog',
	46: 'Rain',
	47: 'Rain',
};

function pickIconCode(...candidates) {
	for (const candidate of candidates) {
		const raw = candidate?.value ?? candidate;
		const code = Number(raw);
		if (Number.isFinite(code)) return code;
	}
	return null;
}

function pickConditionText(...candidates) {
	for (const candidate of candidates) {
		if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
		if (candidate && typeof candidate === 'object') {
			const en = candidate.en ?? candidate.value;
			if (typeof en === 'string' && en.trim()) return en.trim();
		}
	}
	return '';
}

function simplifyCondition(text, iconCode) {
	if (iconCode != null && ICON_CONDITION[iconCode]) {
		return ICON_CONDITION[iconCode];
	}

	const lower = text.toLowerCase();
	if (!lower) return '';
	if (/\b(fog|mist|haze)\b/.test(lower)) return 'Fog';
	if (/\b(snow|flurries|blizzard|ice pellets|freezing)\b/.test(lower)) return 'Snow';
	if (/\b(thunder|storm)\b/.test(lower)) return 'Rain';
	if (/\b(rain|shower|drizzle|precip)\b/.test(lower)) return 'Rain';
	if (/\b(sun|clear|fair)\b/.test(lower)) return 'Sunny';
	if (/\b(cloud|overcast)\b/.test(lower)) return 'Cloudy';
	return text;
}

function toLiveData(citypageProps) {
	const en = geometEn(citypageProps);
	const current = geometEn(citypageProps.currentConditions || {});
	const hourlyGroup = geometEn(citypageProps.hourlyForecastGroup || {});
	const hourly = Array.isArray(hourlyGroup.hourlyForecasts)
		? geometEn(hourlyGroup.hourlyForecasts[0] || {})
		: {};
	const forecastGroup = geometEn(citypageProps.forecastGroup || {});
	const today = Array.isArray(forecastGroup.forecasts)
		? geometEn(forecastGroup.forecasts[0] || {})
		: {};

	const tempC = current?.temperature?.value ?? null;
	const windKph = current?.wind?.speed?.value ?? null;
	const gustKph = current?.wind?.gust?.value ?? null;
	const windDegree = current?.wind?.bearing?.value ?? null;
	const windDir = current?.wind?.direction?.value ?? '';
	const humidity = current?.relativeHumidity?.value ?? null;
	const pressureKpa = current?.pressure?.value ?? null;
	const windChill = current?.windChill?.value ?? null;
	const lastUpdated = formatLastUpdated(
		typeof current?.timestamp === 'string' ? current.timestamp : en?.lastUpdated,
	);

	const iconCode = pickIconCode(
		current?.iconCode,
		hourly?.iconCode,
		today?.abbreviatedForecast?.icon,
	);
	const conditionText = pickConditionText(
		current?.condition,
		hourly?.condition,
		today?.abbreviatedForecast?.textSummary,
	);
	const condition = simplifyCondition(conditionText, iconCode);

	return {
		source: 'msc-geomet',
		current: {
			cloud: 0,
			condition,
			condition_text: conditionText || condition,
			icon: iconCode,
			feelslike_c: windChill ?? tempC,
			feelslike_f:
				windChill != null
					? Math.round(((windChill * 9) / 5 + 32) * 10) / 10
					: tempC != null
						? Math.round(((tempC * 9) / 5 + 32) * 10) / 10
						: null,
			gust_kph: gustKph,
			gust_mph: gustKph != null ? Math.round(gustKph * 0.621371 * 10) / 10 : null,
			humidity,
			is_day: 1,
			last_updated: lastUpdated,
			last_updated_epoch: null,
			precip_in: 0,
			precip_mm: 0,
			pressure_in: pressureKpa != null ? Math.round(pressureKpa * 0.2953 * 100) / 100 : null,
			pressure_mb: pressureKpa != null ? Math.round(pressureKpa * 10) : null,
			temp_c: tempC,
			temp_f: tempC != null ? Math.round(((tempC * 9) / 5 + 32) * 10) / 10 : null,
			uv: 0,
			vis_km: 10,
			vis_miles: 6,
			wind_degree: windDegree != null ? Math.round(Number(windDegree)) : null,
			wind_dir: typeof windDir === 'string' ? windDir : '',
			wind_kph: windKph != null ? Number(windKph) : 0,
			wind_mph: windKph != null ? Math.round(windKph * 0.621371 * 10) / 10 : null,
		},
	};
}

function jsonResponse(body, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Cache-Control': `public, max-age=${CACHE_TTL_SECONDS}`,
			'Access-Control-Allow-Origin': '*',
		},
	});
}

export async function onRequestGet(context) {
	const url = new URL(context.request.url);
	let lat = DEFAULT_LAT;
	let lon = DEFAULT_LON;
	if (url.searchParams.has('lat') && url.searchParams.has('lon')) {
		const parsedLat = Number(url.searchParams.get('lat'));
		const parsedLon = Number(url.searchParams.get('lon'));
		if (Number.isFinite(parsedLat) && Number.isFinite(parsedLon)) {
			lat = parsedLat;
			lon = parsedLon;
		}
	}

	const cache = caches.default;
	const cacheKey = new Request(
		`https://art.adamsimms.xyz/adrift/api/weather?lat=${lat}&lon=${lon}&v=condition`,
		{ method: 'GET' },
	);
	const cached = await cache.match(cacheKey);
	if (cached) {
		return cached;
	}

	const props = await citypage(lat, lon);
	if (!props) {
		return jsonResponse({ error: 'MSC GeoMet citypage weather unavailable', source: 'msc-geomet' }, 502);
	}

	const payload = toLiveData(props);
	const response = jsonResponse(payload);
	context.waitUntil(cache.put(cacheKey, response.clone()));
	return response;
}
