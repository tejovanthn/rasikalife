import type { LoaderFunction } from 'react-router';

export const loader: LoaderFunction = async () => {
  const baseUrl = 'https://rasika.life';
  const lastMod = new Date().toISOString();

  // List of all sub-sitemaps
  const sitemaps = [`${baseUrl}/sitemap-static.xml`, `${baseUrl}/sitemap-talas.xml`];

  // Entities to split by alphabet
  const splitEntities = ['artists', 'compositions', 'ragas'];
  const chars = 'abcdefghijklmnopqrstuvwxyz'.split('');

  for (const entity of splitEntities) {
    for (const char of chars) {
      sitemaps.push(`${baseUrl}/sitemap-${entity}-${char}.xml`);
    }
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
