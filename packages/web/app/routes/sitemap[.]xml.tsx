import type { LoaderFunction } from 'react-router';

export const loader: LoaderFunction = async () => {
  const baseUrl = 'https://rasika.life';
  const lastMod = new Date().toISOString();

  // List of all sub-sitemaps
  const sitemaps = [`${baseUrl}/sitemap-static.xml`, `${baseUrl}/sitemap/talas.xml`];

  // Entities to split by alphabet
  const splitEntities = ['artists', 'compositions', 'ragas', 'venues', 'organisers'];
  const chars = 'abcdefghijklmnopqrstuvwxyz'.split('');

  for (const entity of splitEntities) {
    for (const char of chars) {
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
