// Email delivery via Resend (https://resend.com).
//
// Cloudflare Email Sending is for transactional mail only — not newsletter /
// campaign blasts — so this Worker uses Resend for subscribe confirms,
// notifications, and /admin campaigns.
//
// Setup:
//   1. Create a Resend account and verify adamsimms.xyz (SPF/DKIM).
//   2. npx wrangler secret put RESEND_API_KEY
//   3. FROM_EMAIL must be an address on that verified domain.

export type MailEnv = {
	FROM_NAME?: string;
	FROM_EMAIL?: string;
	RESEND_API_KEY?: string;
} & Record<string, unknown>;

/** True once RESEND_API_KEY is set on the Worker. */
export function isEmailConfigured(env: MailEnv): boolean {
	return Boolean(env.RESEND_API_KEY);
}

export async function sendEmail(
	env: MailEnv,
	opts: {
		to: string;
		subject: string;
		html: string;
		// RFC 8058 one-click unsubscribe — pass through to Resend.
		headers: Record<string, string>;
	},
): Promise<void> {
	const apiKey = env.RESEND_API_KEY;
	if (!apiKey) {
		throw new Error("RESEND_API_KEY is not configured.");
	}

	const fromEmail = env.FROM_EMAIL || "hello@adamsimms.xyz";
	const fromName = env.FROM_NAME || "Adam Simms";
	const sender = `${fromName} <${fromEmail}>`;

	const res = await fetch("https://api.resend.com/emails", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${apiKey}`,
		},
		body: JSON.stringify({
			from: sender,
			to: [opts.to],
			subject: opts.subject,
			html: opts.html,
			headers: opts.headers,
		}),
	});

	if (!res.ok) {
		const detail = await res.text().catch(() => "");
		throw new Error(`Resend send failed: ${res.status} ${detail}`);
	}
}
