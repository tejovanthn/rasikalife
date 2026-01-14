import type { LoaderFunction } from 'react-router';
import { convert } from 'url-slug';
import { client } from '~/api.server';

export const loader: LoaderFunction = async ({ request }) => {
  const baseUrl = 'https://rasika.life';

  try {
    // Collect all entities using existing list APIs
    const [artists, compositions, ragas, talas] = await Promise.all([
      collectAllEntities(client.artist.list, 'artists'),
      collectAllEntities(client.composition.list, 'compositions'),
      collectAllEntities(client.raga.list, 'ragas'),
      collectAllEntities(client.tala.list, 'talas'),
    ]);

    // Generate URLs directly without generic dependencies
    const generateEntityUrl = (type: string, name: string, id: string) => {
      const slug = convert(`${name}-${id}`, { camelCase: false });
      return `${baseUrl}/carnatic/${type}/${slug}`;
    };

    // Generate XML sitemap
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${artists
  .map(
    (artist: any) => `  <url>
    <loc>${generateEntityUrl('artists', artist.name, artist.id)}</loc>
    <lastmod>${artist.updatedAt || artist.createdAt}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`
  )
  .join('\n')}

${compositions
  .map(
    (comp: any) => `  <url>
    <loc>${generateEntityUrl('compositions', comp.title, comp.id)}</loc>
    <lastmod>${comp.updatedAt || comp.createdAt}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`
  )
  .join('\n')}

${ragas
  .map(
    (raga: any) => `  <url>
    <loc>${generateEntityUrl('ragas', raga.name, raga.id)}</loc>
    <lastmod>${raga.updatedAt || raga.createdAt}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`
  )
  .join('\n')}

${talas
  .map(
    (tala: any) => `  <url>
    <loc>${generateEntityUrl('talas', tala.name, tala.id)}</loc>
    <lastmod>${tala.updatedAt || tala.createdAt}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`
  )
  .join('\n')}
</urlset>`;

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=86400', // 24 hours cache
      },
    });
  } catch (error) {
    console.error('Error generating sitemap:', error);

    // Return minimal sitemap on error
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
</urlset>`;

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600', // 1 hour fallback cache
      },
    });
  }
};

// Helper function to collect all entities with pagination
async function collectAllEntities(listFn: any, type: string) {
  const entities: any[] = [];
  let nextToken: string | undefined;

  do {
    const result = await listFn.query({
      limit: 100,
      nextToken,
    });
    entities.push(...result.items);
    nextToken = result.nextToken;
  } while (nextToken);

  return entities;
}
