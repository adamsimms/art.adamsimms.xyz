/**
 * Waves health probe.
 * Route: GET /waves/health
 */

export async function onRequestGet(context) {
	const started = Date.now();
	let status = 'ok';
	let station = null;
	let observedAt = null;
	const origin = new URL(context.request.url).origin;

	try {
		const res = await fetch(`${origin}/waves/call-api`, {
			headers: { Accept: 'application/json' },
		});
		if (!res.ok) {
			status = 'degraded';
		} else {
			const data = await res.json();
			station = data.station_name || null;
			observedAt = data.time_iso || null;
		}
	} catch {
		status = 'degraded';
	}

	return new Response(
		JSON.stringify({
			status,
			time: new Date().toISOString(),
			elapsed_ms: Date.now() - started,
			station,
			observed_at: observedAt,
		}),
		{
			status: status === 'ok' ? 200 : 503,
			headers: {
				'Content-Type': 'application/json; charset=utf-8',
				'Cache-Control': 'no-store',
			},
		},
	);
}
