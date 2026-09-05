import seriesData from '../../content/outport/series.json';
import {
	coverImageCell,
	feedTitle,
	formatOutportDate,
	getOutportEntries,
	type OutportSeries,
} from '../../lib/outport';
import { absoluteUrl, SITE_NAME, socialImageUrl } from '../../lib/seo';

const series = seriesData as OutportSeries;

function escapeXml(value: string): string {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

export async function GET() {
	const entries = await getOutportEntries(false);
	const channelTitle = `${series.title} · ${SITE_NAME}`;
	const channelLink = absoluteUrl('/outport');
	const channelDescription = series.seoDescription || series.title;

	const items = entries
		.map((entry) => {
			const cover = coverImageCell(entry.data.rows);
			const itemLink = `${channelLink}#${entry.data.slug}`;
			const pubDate = entry.data.date.toUTCString();
			const title = feedTitle(entry);
			const place = cover?.place?.trim();
			const image = cover ? socialImageUrl(cover.src, cover.fallback) : '';

			return `
    <item>
      <title>${escapeXml(title)}</title>
      <link>${escapeXml(itemLink)}</link>
      <guid isPermaLink="true">${escapeXml(itemLink)}</guid>
      <pubDate>${escapeXml(pubDate)}</pubDate>
      <description>${escapeXml(place ? `${place} · ${formatOutportDate(entry.data.date)}` : formatOutportDate(entry.data.date))}</description>
      ${image ? `<enclosure url="${escapeXml(image)}" type="image/jpeg" />` : ''}
    </item>`;
		})
		.join('');

	const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(channelTitle)}</title>
    <link>${escapeXml(channelLink)}</link>
    <description>${escapeXml(channelDescription)}</description>
    <language>en-ca</language>
    <lastBuildDate>${escapeXml(new Date().toUTCString())}</lastBuildDate>
    <atom:link href="${escapeXml(absoluteUrl('/outport/feed.xml'))}" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`;

	return new Response(xml, {
		headers: {
			'Content-Type': 'application/rss+xml; charset=utf-8',
		},
	});
}
