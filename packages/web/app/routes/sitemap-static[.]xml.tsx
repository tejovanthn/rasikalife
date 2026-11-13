import { DEFAULT_EVENT_TIMEZONE } from '@rasika/core/domain/event/client';
import { startOfDayInstant, todayInTimeZone } from '@rasika/core/shared/timezone';
import type { LoaderFunction } from 'react-router';
import { client } from '~/api.server';
import { DATE_PRESETS, listingHref } from '~/lib/event-filters';
import { STATIC_SITEMAP_PAGES } from '~/lib/sitemap-static';

/**
 * `/events/<city>` for every city with a concert coming up (a city with none carries
 * `noindex`, so listing it would contradict the page), and the `/events/<preset>` date pages.
 */
async function cityConcertPages(): Promise<
  Array<{ path: string; changefreq: string; priority: number }>
> {
  const zone = DEFAULT_EVENT_TIMEZONE;
  const listings = await client.event.upcomingListings
    .query({ from: startOfDayInstant(todayInTimeZone(zone), zone) })
    .catch(() => []);
  const slugs = [...new Set(listings.map(e => e.citySlug).filter((s): s is string => Boolean(s)))];
  return [
    ...slugs.map(slug => ({
      path: listingHref({ kind: 'city', slug }, {}),
      changefreq: 'daily',
      priority: 0.8,
    })),
    ...DATE_PRESETS.map(p => ({
      path: listingHref({ kind: 'all' }, { when: p.value }),
      changefreq: 'daily',
      priority: 0.7,
    })),
  ];
}

export const loader: LoaderFunction = async () => {
  const baseUrl = 'https://rasika.life';
  const lastMod = '2025-01-01T00:00:00.000Z';

  const pages = [...STATIC_SITEMAP_PAGES, ...(await cityConcertPages())];

  const entries = pages
    .map(
      p => `  <url>
    <loc>${baseUrl}${p.path}</loc>
    <lastmod>${lastMod}</lastmod>
    <changefreq>${p.changefreq}</changefreq>
    <priority>${p.priority}</priority>
  </url>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${entries}
</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
