import type { LoaderFunction } from 'react-router';
import { convert } from 'url-slug';
import { client } from '~/api.server';

export const loader: LoaderFunction = async ({ params }) => {
  const baseUrl = 'https://rasika.life';
  const typeParam = params.type || '';

  let entityType: 'artist' | 'raga' | 'tala' | 'composition';
  let startsWith: string | undefined;

  // Parse type parameter
  if (typeParam === 'talas') {
    entityType = 'tala';
  } else if (typeParam.indexOf('artists-') === 0) {
    entityType = 'artist';
    startsWith = typeParam.replace('artists-', '');
  } else if (typeParam.indexOf('ragas-') === 0) {
    entityType = 'raga';
    startsWith = typeParam.replace('ragas-', '');
  } else if (typeParam.indexOf('compositions-') === 0) {
    entityType = 'composition';
    startsWith = typeParam.replace('compositions-', '');
  } else {
    // 404 for unknown sitemap types
    throw new Response('Not Found', { status: 404 });
  }

  try {
    const { documents } = await client.search.documents.query({
      type: entityType,
      startsWith,
    });

    const generateEntityUrl = (type: string, name: string, id: string) => {
      const slug = convert(`${name}-${id}`, { camelCase: false });
      return `${baseUrl}/carnatic/${type}/${slug}`;
    };

    const entityConfig = {
      artist: { urlPath: 'artists', priority: 0.6 },
      composition: { urlPath: 'compositions', priority: 0.7 },
      raga: { urlPath: 'ragas', priority: 0.5 },
      tala: { urlPath: 'talas', priority: 0.5 },
    } as const;

    const entries = documents
      .map(doc => {
        const config = entityConfig[doc.entityType];
        // Double check entity type matches (though query should handle it)
        if (doc.entityType !== entityType) return '';

        const url = generateEntityUrl(config.urlPath, doc.displayName, doc.id);

        return `  <url>
    <loc>${url}</loc>
    <lastmod>${doc.indexedAt}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>${config.priority}</priority>
  </url>`;
      })
      .filter(Boolean)
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
  } catch (error) {
    console.error('Error generating sitemap:', error);

    // Return empty sitemap on error instead of breaking
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`;

    return new Response(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }
};
