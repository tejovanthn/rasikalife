import type { LoaderFunction } from 'react-router';
import { client } from '~/api.server';

export const loader: LoaderFunction = async () => {
  const baseUrl = 'https://rasika.life';
  const lastMod = '2025-01-01T00:00:00.000Z';

  // List of all sub-sitemaps
  const sitemaps = [`${baseUrl}/sitemap-static.xml`, `${baseUrl}/sitemap/talas.xml`];

  // Entities to split by alphabet
  const splitEntities = ['artists', 'compositions', 'ragas', 'venues', 'organisers'];
  const chars = 'abcdefghijklmnopqrstuvwxyz'.split('');

  // Letters with nothing to list are left out (Search Console flags an empty child sitemap).
  // Read from the cached search index, not a scan. If it cannot be read, list every letter.
  const letters = await client.search.sitemapLetters.query().catch(() => null);
  const singular: Record<string, 'artist' | 'composition' | 'raga' | 'venue' | 'organiser'> = {
    artists: 'artist',
    compositions: 'composition',
    ragas: 'raga',
    venues: 'venue',
    organisers: 'organiser',
  };

  for (const entity of splitEntities) {
    for (const char of chars) {
      if (letters && !letters[singular[entity]].includes(char)) continue;
      sitemaps.push(`${baseUrl}/sitemap/${entity}-${char}.xml`);
    }
  }

  // Events: rolling 24-month window (12 past + 12 future)
  const now = new Date();
  for (let offset = -12; offset <= 12; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    sitemaps.push(`${baseUrl}/sitemap/events-${year}-${month}.xml`);
  }

  // Festivals: rolling 24-month window (12 past + 12 future)
  for (let offset = -12; offset <= 12; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    sitemaps.push(`${baseUrl}/sitemap/festivals-${year}-${month}.xml`);
  }

  const sitemapEntries = sitemaps
    .map(
      url => `  <sitemap>
    <loc>${url}</loc>
    <lastmod>${lastMod}</lastmod>
  </sitemap>`
    )
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</sitemapindex>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=86400',
    },
  });
};
