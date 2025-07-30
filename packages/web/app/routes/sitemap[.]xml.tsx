import type { LoaderFunction } from '@remix-run/node';
import { client } from '~/api.server';

export const loader: LoaderFunction = async ({ request }) => {
  const baseUrl = 'https://rasika.life';

  try {
    // Get all compositions, artists, ragas, and talas for sitemap
    const [compositions, artists, ragas, talas] = await Promise.all([
      client.composition.search.query({ limit: 1000 }),
      client.artist.search.query({ limit: 1000 }),
      client.raga.search.query({ limit: 1000 }),
      client.tala.search.query({ limit: 1000 }),
    ]);

    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <!-- Static pages -->
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>${baseUrl}/carnatic</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.9</priority>
  </url>
  <url>
    <loc>${baseUrl}/carnatic/compositions</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/carnatic/artists</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>
  <url>
    <loc>${baseUrl}/carnatic/ragas</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${baseUrl}/carnatic/talas</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>

  <!-- Dynamic compositions -->
  ${compositions.items
    .map(
      composition => `
  <url>
    <loc>${baseUrl}/carnatic/compositions/${composition.title
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')}-${composition.id}</loc>
    <lastmod>${new Date(composition.updatedAt).toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`
    )
    .join('')}

  <!-- Dynamic artists -->
  ${artists.items
    .map(
      artist => `
  <url>
    <loc>${baseUrl}/carnatic/artists/${artist.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')}-${artist.id}</loc>
    <lastmod>${new Date(artist.updatedAt).toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`
    )
    .join('')}

  <!-- Dynamic ragas -->
  ${ragas.items
    .map(
      raga => `
  <url>
    <loc>${baseUrl}/carnatic/ragas/${raga.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')}-${raga.id}</loc>
    <lastmod>${new Date(raga.updatedAt).toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.4</priority>
  </url>`
    )
    .join('')}

  <!-- Dynamic talas -->
  ${talas.items
    .map(
      tala => `
  <url>
    <loc>${baseUrl}/carnatic/talas/${tala.name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '-')
      .replace(/-+/g, '-')}-${tala.id}</loc>
    <lastmod>${new Date(tala.updatedAt).toISOString()}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.4</priority>
  </url>`
    )
    .join('')}
</urlset>`;

    return new Response(sitemap, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600', // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error('Error generating sitemap:', error);
    return new Response('Error generating sitemap', { status: 500 });
  }
};
