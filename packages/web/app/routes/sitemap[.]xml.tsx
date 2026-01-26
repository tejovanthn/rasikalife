import type { LoaderFunction } from 'react-router';
import { convert } from 'url-slug';
import { client } from '~/api.server';

export const loader: LoaderFunction = async () => {
  const baseUrl = 'https://rasika.life';

  try {
    // Use the search index instead of scanning the database again
    const { documents, builtAt } = await client.search.documents.query();

    // Generate URL for each entity
    const generateEntityUrl = (type: string, name: string, id: string) => {
      const slug = convert(`${name}-${id}`, { camelCase: false });
      return `${baseUrl}/carnatic/${type}/${slug}`;
    };

    // Priority and change frequency by entity type
    const entityConfig = {
      artist: { urlPath: 'artists', priority: 0.6 },
      composition: { urlPath: 'compositions', priority: 0.7 },
      raga: { urlPath: 'ragas', priority: 0.5 },
      tala: { urlPath: 'talas', priority: 0.5 },
    } as const;

    // Generate XML sitemap entries from indexed documents
    const entries = documents
      .map(doc => {
        const config = entityConfig[doc.entityType];
        const url = generateEntityUrl(config.urlPath, doc.displayName, doc.id);

        return `  <url>
    <loc>${url}</loc>
    <lastmod>${doc.indexedAt}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${config.priority}</priority>
  </url>`;
      })
      .join('\n');

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/</loc>
    <lastmod>${builtAt}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
${entries}
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
