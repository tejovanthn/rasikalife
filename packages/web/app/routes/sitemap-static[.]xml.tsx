import type { LoaderFunction } from 'react-router';

export const loader: LoaderFunction = async () => {
  const baseUrl = 'https://rasika.life';
  const lastMod = new Date().toISOString();

  const pages = [
    { path: '/', changefreq: 'weekly', priority: 1.0 },
    { path: '/artists', changefreq: 'daily', priority: 0.8 },
    { path: '/events', changefreq: 'daily', priority: 0.8 },
    { path: '/venues', changefreq: 'weekly', priority: 0.7 },
    { path: '/organisers', changefreq: 'weekly', priority: 0.7 },
    { path: '/festivals', changefreq: 'weekly', priority: 0.7 },
    { path: '/carnatic', changefreq: 'weekly', priority: 0.8 },
    { path: '/carnatic/compositions', changefreq: 'weekly', priority: 0.7 },
    { path: '/carnatic/ragas', changefreq: 'weekly', priority: 0.7 },
    { path: '/carnatic/talas', changefreq: 'monthly', priority: 0.6 },
    { path: '/carnatic/languages', changefreq: 'monthly', priority: 0.6 },
  ];

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
