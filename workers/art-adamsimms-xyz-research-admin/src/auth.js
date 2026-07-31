import { createRemoteJWKSet, jwtVerify } from 'jose';

/**
 * @param {Request} request
 * @param {Env} env
 * @returns {Promise<{ ok: true, email?: string } | { ok: false, response: Response }>}
 */
export async function requireAccess(request, env) {
	if (env.ALLOW_INSECURE_DEV === 'true') {
		return { ok: true, email: 'dev@local' };
	}

	const team = (env.TEAM_DOMAIN || '').replace(/\/$/, '');
	const aud = env.POLICY_AUD || '';

	if (!team || !aud) {
		return {
			ok: false,
			response: new Response(
				'Research admin is not configured. Set TEAM_DOMAIN and POLICY_AUD (Cloudflare Access), then redeploy.',
				{ status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
			),
		};
	}

	const token = request.headers.get('cf-access-jwt-assertion');
	if (!token) {
		return {
			ok: false,
			response: new Response('Missing Cloudflare Access token', {
				status: 403,
				headers: { 'Content-Type': 'text/plain; charset=utf-8' },
			}),
		};
	}

	try {
		const issuer = team.startsWith('https://') ? team : `https://${team}`;
		const JWKS = createRemoteJWKSet(new URL(`${issuer}/cdn-cgi/access/certs`));
		const { payload } = await jwtVerify(token, JWKS, {
			issuer,
			audience: aud,
		});
		return { ok: true, email: /** @type {string|undefined} */ (payload.email) };
	} catch (err) {
		const message = err instanceof Error ? err.message : 'invalid token';
		return {
			ok: false,
			response: new Response(`Invalid Access token: ${message}`, {
				status: 403,
				headers: { 'Content-Type': 'text/plain; charset=utf-8' },
			}),
		};
	}
}
