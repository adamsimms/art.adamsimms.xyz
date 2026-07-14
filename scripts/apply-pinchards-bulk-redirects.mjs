#!/usr/bin/env node
/**
 * Apply docs/PHASE5-REDIRECTS.json as a Cloudflare Bulk Redirect list + rule.
 *
 * Env:
 *   CLOUDFLARE_API_TOKEN  — Account Filter Lists Edit + Bulk URL Redirects Edit
 *   CLOUDFLARE_ACCOUNT_ID — adamsimms.xyz account
 */
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ART_ROOT = resolve(__dirname, '..');
const MAP_PATH = join(ART_ROOT, 'docs/PHASE5-REDIRECTS.json');
const ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const TOKEN = process.env.CLOUDFLARE_API_TOKEN;

if (!ACCOUNT_ID || !TOKEN) {
	console.error('Need CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN');
	process.exit(1);
}

const map = JSON.parse(readFileSync(MAP_PATH, 'utf8'));
const defaults = map.defaults || {};
const listName = map.list_name;
const api = (path, { method = 'GET', body } = {}) =>
	fetch(`https://api.cloudflare.com/client/v4${path}`, {
		method,
		headers: {
			Authorization: `Bearer ${TOKEN}`,
			'Content-Type': 'application/json',
		},
		body: body === undefined ? undefined : JSON.stringify(body),
	}).then(async (res) => {
		const data = await res.json();
		if (!data.success) {
			const err = JSON.stringify(data.errors || data, null, 2);
			throw new Error(`${method} ${path} failed:\n${err}`);
		}
		return data.result;
	});

function toItem(entry) {
	const redirect = {
		source_url: entry.source_url.replace(/^https?:\/\//, ''),
		target_url: entry.target_url,
		status_code: entry.status_code ?? defaults.status_code ?? 301,
		preserve_query_string:
			entry.preserve_query_string ?? defaults.preserve_query_string ?? true,
		include_subdomains:
			entry.include_subdomains ?? defaults.include_subdomains ?? true,
		subpath_matching: entry.subpath_matching ?? defaults.subpath_matching ?? false,
		preserve_path_suffix:
			entry.preserve_path_suffix ?? defaults.preserve_path_suffix ?? true,
	};
	return { redirect };
}

async function waitOp(operationId) {
	for (let i = 0; i < 60; i++) {
		const op = await api(`/accounts/${ACCOUNT_ID}/rules/lists/bulk_operations/${operationId}`);
		if (op.status === 'completed') return op;
		if (op.status === 'failed') {
			throw new Error(`bulk op failed: ${JSON.stringify(op)}`);
		}
		await new Promise((r) => setTimeout(r, 1000));
	}
	throw new Error(`bulk op timed out: ${operationId}`);
}

async function ensureList() {
	const lists = await api(`/accounts/${ACCOUNT_ID}/rules/lists`);
	const existing = (lists || []).find((l) => l.name === listName && l.kind === 'redirect');
	if (existing) {
		console.log(`Using existing list ${listName} (${existing.id})`);
		return existing;
	}
	const created = await api(`/accounts/${ACCOUNT_ID}/rules/lists`, {
		method: 'POST',
		body: {
			name: listName,
			description: map.list_description || 'Phase 5 pinchards → art',
			kind: 'redirect',
		},
	});
	console.log(`Created list ${listName} (${created.id})`);
	return created;
}

async function replaceItems(listId) {
	const payload = map.redirects.map(toItem);
	const put = await api(`/accounts/${ACCOUNT_ID}/rules/lists/${listId}/items`, {
		method: 'PUT',
		body: payload,
	});
	if (put?.operation_id) await waitOp(put.operation_id);
	console.log(`Wrote ${payload.length} redirect(s)`);
}

async function ensureRule() {
	const expression = `http.request.full_uri in $${listName}`;
	const rulesets = await api(
		`/accounts/${ACCOUNT_ID}/rulesets/phases/http_request_redirect/entrypoint`,
	).catch(() => null);

	const newRule = {
		ref: `enable_${listName}`,
		expression,
		description: 'Phase 5: pinchards.is → art.adamsimms.xyz',
		action: 'redirect',
		action_parameters: {
			from_list: {
				name: listName,
				key: 'http.request.full_uri',
			},
		},
		enabled: true,
	};

	if (!rulesets || !rulesets.id) {
		await api(`/accounts/${ACCOUNT_ID}/rulesets`, {
			method: 'POST',
			body: {
				name: 'Bulk Redirects',
				kind: 'root',
				phase: 'http_request_redirect',
				rules: [newRule],
			},
		});
		console.log('Created http_request_redirect ruleset with pinchards rule');
		return;
	}

	const rules = Array.isArray(rulesets.rules) ? [...rulesets.rules] : [];
	const idx = rules.findIndex(
		(r) => r.ref === newRule.ref || r.action_parameters?.from_list?.name === listName,
	);
	if (idx >= 0) {
		rules[idx] = { ...rules[idx], ...newRule };
	} else {
		rules.push(newRule);
	}

	await api(`/accounts/${ACCOUNT_ID}/rulesets/${rulesets.id}`, {
		method: 'PUT',
		body: {
			name: rulesets.name || 'Bulk Redirects',
			description: rulesets.description || '',
			kind: 'root',
			phase: 'http_request_redirect',
			rules,
		},
	});
	console.log('Enabled Bulk Redirect rule for', listName);
}

const list = await ensureList();
await replaceItems(list.id);
await ensureRule();
console.log('Done. Smoke-test https://www.pinchards.is/ → art archive.');
