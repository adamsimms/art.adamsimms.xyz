/**
 * Waves ERDDAP station poll — SmartAtlantic St. John's buoy.
 * Route: GET /waves/call-api
 */

const ERDDAP_STATION_URL = 'https://www.smartatlantic.ca/erddap/tabledap/SMA_st_johns.json';
const ERDDAP_COLUMNS =
	'station_name,time,longitude,latitude,wind_spd_avg,wind_spd_max,wind_dir_avg,air_temp_avg,air_pressure_avg,air_humidity_avg,air_dewpoint_avg,surface_temp_avg,wave_ht_max,wave_ht_sig,wave_period_max,wave_dir_avg,wave_spread_avg,curr_dir_avg,curr_spd_avg';
const LOOKBACK_SECONDS = 3 * 24 * 60 * 60;
const CACHE_TTL_MS = 60_000;

function isMissing(value) {
	if (value == null || value === '') return true;
	if (typeof value === 'string' && /^nan$/i.test(value.trim())) return true;
	if (typeof value === 'number' && !Number.isFinite(value)) return true;
	return false;
}

function optionalFloat(value) {
	if (isMissing(value)) return null;
	const n = Number(value);
	return Number.isFinite(n) ? n : null;
}

function resolveFloat(value, fallback) {
	const n = optionalFloat(value);
	return n == null ? fallback : n;
}

function stringValue(value, fallback) {
	if (isMissing(value)) return fallback;
	return String(value);
}

function windComponents(speed, direction, previous) {
	if (direction != null && speed > 0) {
		const radians = (direction * Math.PI) / 180;
		return {
			wind_x: -speed * Math.sin(radians),
			wind_y: -speed * Math.cos(radians),
		};
	}
	if (previous?.wind_x != null && previous?.wind_y != null && speed > 0) {
		const prevSpeed = Math.hypot(previous.wind_x, previous.wind_y);
		if (prevSpeed > 0) {
			const scale = speed / prevSpeed;
			return { wind_x: previous.wind_x * scale, wind_y: previous.wind_y * scale };
		}
	}
	return { wind_x: speed, wind_y: speed };
}

function defaultStation() {
	const components = windComponents(10, null, {});
	const now = new Date();
	return {
		station_name: "St. John's Buoy",
		time: now.toISOString().replace(/\.\d{3}Z$/, 'Z'),
		time_display: now.toISOString().slice(0, 19).replace('T', ' '),
		wind: 10,
		wind_dir: null,
		wind_x: components.wind_x,
		wind_y: components.wind_y,
		size: 250,
		wave_period: 150,
		choppiness: 1.5,
	};
}

function buildStation(fields, previous) {
	const observedAt = stringValue(fields.time, previous.time);
	const wind = resolveFloat(fields.wind_spd_avg, previous.wind);
	const windDir = optionalFloat(fields.wind_dir_avg) ?? optionalFloat(previous.wind_dir);
	const wavePeriod = resolveFloat(
		fields.wave_period_max,
		Math.max(0, (previous.size ?? 250) - 100),
	);
	const choppiness = resolveFloat(fields.wave_ht_max, previous.choppiness ?? 1.5);
	const components = windComponents(wind, windDir, previous);
	const observedDate = new Date(observedAt);
	const timeDisplay = Number.isNaN(observedDate.getTime())
		? previous.time_display
		: observedDate.toISOString().slice(0, 19).replace('T', ' ');

	return {
		station_name: stringValue(fields.station_name, previous.station_name),
		time: observedAt,
		time_display: timeDisplay,
		wind,
		wind_dir: windDir,
		wind_x: components.wind_x,
		wind_y: components.wind_y,
		size: 100 + wavePeriod,
		wave_period: wavePeriod,
		choppiness,
	};
}

function toClientJson(data) {
	return {
		station_name: data.station_name,
		time: data.time_display,
		time_iso: data.time,
		wind: data.wind,
		wind_dir: data.wind_dir,
		wind_x: data.wind_x,
		wind_y: data.wind_y,
		size: data.size,
		wave_period: data.wave_period ?? Math.max(0, data.size - 100),
		choppiness: data.choppiness,
	};
}

async function fetchFromErddap() {
	const end = new Date();
	const start = new Date(end.getTime() - LOOKBACK_SECONDS * 1000);
	const fmt = (d) => d.toISOString().replace(/\.\d{3}Z$/, 'Z');
	const url =
		`${ERDDAP_STATION_URL}?${ERDDAP_COLUMNS}` +
		`&time>=${encodeURIComponent(fmt(start))}` +
		`&time<=${encodeURIComponent(fmt(end))}`;

	const res = await fetch(url, {
		headers: {
			Accept: 'application/json',
			'User-Agent': 'waves (ERDDAP; art.adamsimms.xyz/waves)',
		},
	});
	if (!res.ok) {
		throw new Error(`ERDDAP HTTP ${res.status}`);
	}
	const payload = await res.json();
	const rows = payload?.table?.rows;
	const columnNames = payload?.table?.columnNames;
	if (!Array.isArray(rows) || rows.length === 0 || !Array.isArray(columnNames)) {
		throw new Error('No buoy readings returned');
	}
	const latest = rows[rows.length - 1];
	const fields = {};
	columnNames.forEach((name, i) => {
		fields[name] = latest[i];
	});
	return buildStation(fields, defaultStation());
}

function jsonResponse(body, status = 200, maxAge = 10) {
	return new Response(JSON.stringify(body), {
		status,
		headers: {
			'Content-Type': 'application/json; charset=utf-8',
			'Cache-Control': status === 200 ? `public, max-age=${maxAge}` : 'no-store',
			'Access-Control-Allow-Origin': '*',
		},
	});
}

export async function onRequestGet(context) {
	const cache = caches.default;
	const cacheKey = new Request('https://art.adamsimms.xyz/waves/call-api', { method: 'GET' });
	const cached = await cache.match(cacheKey);
	if (cached) {
		const ageHeader = cached.headers.get('x-waves-cached-at');
		if (ageHeader) {
			const age = Date.now() - Number(ageHeader);
			if (Number.isFinite(age) && age < CACHE_TTL_MS) {
				return cached;
			}
		}
	}

	try {
		const station = await fetchFromErddap();
		const response = jsonResponse(toClientJson(station), 200, 10);
		response.headers.set('x-waves-cached-at', String(Date.now()));
		context.waitUntil(cache.put(cacheKey, response.clone()));
		return response;
	} catch (err) {
		const message = err instanceof Error ? err.message : 'ERDDAP unavailable';
		return jsonResponse({ error: message }, 503);
	}
}
