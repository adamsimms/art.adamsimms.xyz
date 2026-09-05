import type { CollectionEntry } from 'astro:content';

export type OutportEntry = CollectionEntry<'outport'>;
export type OutportCell = OutportEntry['data']['rows'][number]['cells'][number];
export type OutportTextStyle = 'title' | 'quote' | 'micro' | 'small';

export type OutportSeries = {
	title: string;
	medium?: string;
	year?: string;
	seoDescription?: string;
	description?: string;
	cover?: string;
	coverFallback?: string;
	coverAlt?: string;
};

const SPACE_HEIGHTS: Record<string, string> = {
	s: 'var(--space-s)',
	m: 'var(--space-m)',
	l: 'var(--space-l)',
	xl: 'var(--space-xl)',
	'2xl': 'var(--space-2xl)',
	'3xl': 'var(--space-3xl)',
};

export function spaceHeight(size: string): string {
	return SPACE_HEIGHTS[size] ?? SPACE_HEIGHTS.xl;
}

export const OUTPORT_TEXT_ALIGN_VALUES = [
	'top-left',
	'top',
	'top-right',
	'left',
	'center',
	'right',
	'bottom-left',
	'bottom',
	'bottom-right',
] as const;

export type OutportTextAlign = (typeof OUTPORT_TEXT_ALIGN_VALUES)[number];
export type OutportRowAlign = 'top' | 'bottom';
export type OutportAlignAxis = 'start' | 'center' | 'end';

const TEXT_ALIGN_MAP: Record<OutportTextAlign, { x: OutportAlignAxis; y: OutportAlignAxis }> = {
	'top-left': { x: 'start', y: 'start' },
	top: { x: 'center', y: 'start' },
	'top-right': { x: 'end', y: 'start' },
	left: { x: 'start', y: 'center' },
	center: { x: 'center', y: 'center' },
	right: { x: 'end', y: 'center' },
	'bottom-left': { x: 'start', y: 'end' },
	bottom: { x: 'center', y: 'end' },
	'bottom-right': { x: 'end', y: 'end' },
};

export function textAlignAxes(align?: OutportTextAlign): {
	x: OutportAlignAxis;
	y: OutportAlignAxis;
} {
	if (!align) return TEXT_ALIGN_MAP['top-left'];
	return TEXT_ALIGN_MAP[align] ?? TEXT_ALIGN_MAP['top-left'];
}

export function isPublishedOutport(entry: OutportEntry, includeDrafts: boolean): boolean {
	if (includeDrafts) return true;
	return !entry.data.draft;
}

export async function getOutportEntries(includeDrafts: boolean): Promise<OutportEntry[]> {
	const { getCollection } = await import('astro:content');
	const all = await getCollection('outport');
	const visible = all.filter((entry) => isPublishedOutport(entry, includeDrafts));
	assertOutportEntries(visible);
	return visible.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export function assertOutportEntries(entries: OutportEntry[]): void {
	const slugs = new Set<string>();
	const slugDupes: string[] = [];

	for (const entry of entries) {
		const slug = entry.data.slug;
		if (slugs.has(slug)) slugDupes.push(slug);
		else slugs.add(slug);

		validateOutportRows(entry.data.slug, entry.data.rows, !entry.data.draft);
	}

	if (slugDupes.length) {
		throw new Error(`Duplicate outport slug(s): ${slugDupes.join(', ')}`);
	}
}

export function validateOutportRows(
	slug: string,
	rows: OutportEntry['data']['rows'],
	requireCover: boolean,
): void {
	let coverCount = 0;

	for (const [rowIndex, row] of rows.entries()) {
		const sum = row.cells.reduce((total, cell) => total + cell.span, 0);
		if (sum !== 4) {
			throw new Error(
				`Outport "${slug}" row ${rowIndex + 1}: cell spans sum to ${sum}, expected 4`,
			);
		}

		for (const [cellIndex, cell] of row.cells.entries()) {
			const label = `Outport "${slug}" row ${rowIndex + 1} cell ${cellIndex + 1}`;

			if (cell.type === 'space') {
				if (cell.span !== 4) {
					throw new Error(`${label}: space cells must have span 4`);
				}
				continue;
			}

			if (cell.type === 'image') {
				if (cell.cover) coverCount += 1;
				continue;
			}

			if (cell.type === 'video') {
				if (cell.cover) {
					throw new Error(`${label}: only image cells can be cover`);
				}
				const landscape = cell.width >= cell.height;
				if (landscape && cell.span < 2) {
					throw new Error(`${label}: landscape video must be span 2 or more`);
				}
			}
		}
	}

	if (requireCover && coverCount !== 1) {
		throw new Error(
			`Outport "${slug}": published posts need exactly one cover image (found ${coverCount})`,
		);
	}
	if (coverCount > 1) {
		throw new Error(`Outport "${slug}": at most one cover image allowed (found ${coverCount})`);
	}
}

export function firstTextForFeed(rows: OutportEntry['data']['rows']): string | undefined {
	for (const row of rows) {
		for (const cell of row.cells) {
			if (cell.type !== 'text') continue;
			if (cell.style === 'title' || cell.style === 'micro') {
				return cell.body.trim();
			}
		}
	}
	return undefined;
}

export function coverImageCell(
	rows: OutportEntry['data']['rows'],
): Extract<OutportCell, { type: 'image' }> | undefined {
	for (const row of rows) {
		for (const cell of row.cells) {
			if (cell.type === 'image' && cell.cover) return cell;
		}
	}
	return undefined;
}

export function formatOutportDate(date: Date): string {
	return date.toLocaleDateString('en-CA', {
		year: 'numeric',
		month: 'long',
		day: 'numeric',
		timeZone: 'UTC',
	});
}

export function feedTitle(entry: OutportEntry): string {
	const cover = coverImageCell(entry.data.rows);
	if (cover?.title?.trim()) return cover.title.trim();
	const text = firstTextForFeed(entry.data.rows);
	if (text) return text;
	return formatOutportDate(entry.data.date);
}
