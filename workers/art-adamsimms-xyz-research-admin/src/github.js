/**
 * @typedef {object} Env
 * @property {R2Bucket} RESEARCH
 * @property {string} [GITHUB_TOKEN]
 * @property {string} [GITHUB_OWNER]
 * @property {string} [GITHUB_REPO]
 * @property {string} [GITHUB_BRANCH]
 * @property {string} [TEAM_DOMAIN]
 * @property {string} [POLICY_AUD]
 * @property {string} [ALLOW_INSECURE_DEV]
 */

/**
 * @param {Env} env
 * @param {string} path - path in repo e.g. src/content/research/foo.md
 * @returns {Promise<{ sha: string, content: string, name: string } | null>}
 */
export async function getRepoFile(env, path) {
	const res = await gh(env, `contents/${path}`);
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`GitHub get ${path}: ${res.status} ${await res.text()}`);
	const data = await res.json();
	const content = atob(data.content.replace(/\n/g, ''));
	return { sha: data.sha, content, name: data.name };
}

/**
 * @param {Env} env
 * @returns {Promise<Array<{ name: string, path: string, sha: string }>>}
 */
export async function listResearchFiles(env) {
	const res = await gh(env, 'contents/src/content/research');
	if (res.status === 404) return [];
	if (!res.ok) throw new Error(`GitHub list research: ${res.status} ${await res.text()}`);
	const data = await res.json();
	if (!Array.isArray(data)) return [];
	return data
		.filter((f) => f.type === 'file' && f.name.endsWith('.md') && !f.name.startsWith('_'))
		.map((f) => ({ name: f.name, path: f.path, sha: f.sha }));
}

/**
 * Create or update a file on the default branch.
 * @param {Env} env
 * @param {{ path: string, content: string, message: string, sha?: string }} opts
 */
export async function putRepoFile(env, opts) {
	const body = {
		message: opts.message,
		content: btoa(unescape(encodeURIComponent(opts.content))),
		branch: env.GITHUB_BRANCH || 'main',
	};
	if (opts.sha) body.sha = opts.sha;

	const res = await gh(env, `contents/${opts.path}`, {
		method: 'PUT',
		body: JSON.stringify(body),
	});
	if (!res.ok) throw new Error(`GitHub put ${opts.path}: ${res.status} ${await res.text()}`);
	return res.json();
}

/**
 * @param {Env} env
 * @param {{ path: string, message: string, sha: string }} opts
 */
export async function deleteRepoFile(env, opts) {
	const res = await gh(env, `contents/${opts.path}`, {
		method: 'DELETE',
		body: JSON.stringify({
			message: opts.message,
			sha: opts.sha,
			branch: env.GITHUB_BRANCH || 'main',
		}),
	});
	if (!res.ok) throw new Error(`GitHub delete ${opts.path}: ${res.status} ${await res.text()}`);
	return res.json();
}

/**
 * @param {Env} env
 * @param {string} pathSuffix
 * @param {RequestInit} [init]
 */
async function gh(env, pathSuffix, init = {}) {
	const token = env.GITHUB_TOKEN;
	if (!token) throw new Error('GITHUB_TOKEN secret is not set');
	const owner = env.GITHUB_OWNER || 'adamsimms';
	const repo = env.GITHUB_REPO || 'art.adamsimms.xyz';
	const url = `https://api.github.com/repos/${owner}/${repo}/${pathSuffix}`;
	return fetch(url, {
		...init,
		headers: {
			Accept: 'application/vnd.github+json',
			Authorization: `Bearer ${token}`,
			'X-GitHub-Api-Version': '2022-11-28',
			'User-Agent': 'art-adamsimms-xyz-research-admin',
			...(init.body ? { 'Content-Type': 'application/json' } : {}),
			...(init.headers || {}),
		},
	});
}
