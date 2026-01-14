import type { LoaderFunction } from 'react-router';
import { convert } from 'url-slug';
import { client } from '~/api.server';
import type { Artist } from '@rasika/core/domain/artist/entity';
import type { Composition } from '@rasika/core/domain/composition/entity';
import type { Raga } from '@rasika/core/domain/raga/entity';
import type { Tala } from '@rasika/core/domain/tala/entity';

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
    artist => `  <url>
    <loc>${generateEntityUrl('artists', (artist as Artist).name, (artist as Artist).id)}</loc>
    <lastmod>${(artist as Artist).updatedAt || (artist as Artist).createdAt}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`
  )
  .join('\n')}

${compositions
  .map(
    comp => `  <url>
    <loc>${generateEntityUrl('compositions', (comp as Composition).title, (comp as Composition).id)}</loc>
    <lastmod>${(comp as Composition).updatedAt || (comp as Composition).createdAt}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`
  )
  .join('\n')}

${ragas
  .map(
    raga => `  <url>
    <loc>${generateEntityUrl('ragas', (raga as Raga).name, (raga as Raga).id)}</loc>
    <lastmod>${(raga as Raga).updatedAt || (raga as Raga).createdAt}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.5</priority>
  </url>`
  )
  .join('\n')}

${talas
  .map(
    tala => `  <url>
    <loc>${generateEntityUrl('talas', (tala as Tala).name, (tala as Tala).id)}</loc>
    <lastmod>${(tala as Tala).updatedAt || (tala as Tala).createdAt}</lastmod>
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
// biome-ignore lint/suspicious/noExplicitAny: tRPC types are complex
async function collectAllEntities(listFn: any, type: string) {
  // biome-ignore lint/suspicious/noExplicitAny: array of entities from API
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
