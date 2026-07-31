/** Escape HTML, then turn `[label](href)` into anchors. Inline links only. */

const ALLOWED_HREF = /^(?:\/[\w./%-]*|https?:\/\/[^\s"'<>]+)$/i;

function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/** Strip `[label](href)` to `label` for meta / plain-text fallbacks. */
export function stripInlineMarkdown(text: string): string {
	return text.replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
}

/** Safe HTML for a single paragraph that may contain markdown links. */
export function inlineMarkdown(text: string): string {
	const escaped = escapeHtml(text);
	return escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, href: string) => {
		const trimmed = href.trim();
		if (!ALLOWED_HREF.test(trimmed)) return label;
		return `<a href="${trimmed}">${label}</a>`;
	});
}
