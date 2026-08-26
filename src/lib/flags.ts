/**
 * Build-time feature flags. Public `PUBLIC_*` env vars, off unless set to `1` or `true`.
 */
function envOn(value: string | undefined) {
	return value === '1' || value === 'true';
}

/** Inverted-circle site cursor. Off by default. */
export const SITE_CURSOR = envOn(import.meta.env.PUBLIC_SITE_CURSOR);
