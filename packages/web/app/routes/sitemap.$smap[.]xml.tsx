import type { LoaderFunction } from 'react-router';
import { client } from '~/api.server';
import {
  generateArtistUrl,
  generateCompositionUrl,
  generateEventUrl,
  generateFestivalUrl,
  generateOrganiserUrl,
  generateRagaUrl,
  generateTalaUrl,
  generateVenueUrl,
} from '~/lib/url-slug';

const emptySitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
</urlset>`;

function buildSitemapXml(entries: string): Response {
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
}

function buildUrlEntry(url: string, lastmod: string, changefreq: string, priority: number) {
  return `  <url>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

type EntityType = 'artist' | 'raga' | 'tala' | 'composition' | 'venue' | 'organiser';

const urlGenerators: Record<EntityType, (name: string, id: string) => string> = {
  artist: generateArtistUrl,
  composition: generateCompositionUrl,
  raga: generateRagaUrl,
  tala: generateTalaUrl,
  venue: generateVenueUrl,
  organiser: generateOrganiserUrl,
};

const entityPriorities: Record<EntityType, number> = {
  artist: 0.6,
  composition: 0.7,
  raga: 0.5,
  tala: 0.5,
  venue: 0.4,
  organiser: 0.4,
};

function parseSearchType(
  typeParam: string
): { entityType: EntityType; startsWith?: string } | null {
  if (typeParam === 'talas') return { entityType: 'tala' };
  const prefixes: Array<{ prefix: string; entityType: EntityType }> = [
    { prefix: 'artists-', entityType: 'artist' },
    { prefix: 'ragas-', entityType: 'raga' },
    { prefix: 'compositions-', entityType: 'composition' },
    { prefix: 'venues-', entityType: 'venue' },
    { prefix: 'organisers-', entityType: 'organiser' },
  ];
  for (const { prefix, entityType } of prefixes) {
    if (typeParam.startsWith(prefix)) {
      return { entityType, startsWith: typeParam.replace(prefix, '') };
    }
  }
  return null;
}

export const loader: LoaderFunction = async ({ params }) => {
  const baseUrl = 'https://rasika.life';
  const typeParam = params.smap || '';

  const temporalTypes = {
    events: {
      fetchByMonth: (yearMonth: string) => client.event.listByMonth.query({ yearMonth }),
      toUrl: (item: { title: string; id: string }) =>
        `${baseUrl}${generateEventUrl(item.title, item.id)}`,
    },
    festivals: {
      fetchByMonth: (yearMonth: string) => client.festival.listByMonth.query({ yearMonth }),
      toUrl: (item: { name: string; id: string }) =>
        `${baseUrl}${generateFestivalUrl(item.name, item.id)}`,
    },
  } as const;

  try {
    // --- Temporal sitemaps: events-{YYYY-MM} and festivals-{YYYY-MM} ---
    for (const [prefix, { fetchByMonth, toUrl }] of Object.entries(temporalTypes)) {
      if (typeParam.startsWith(`${prefix}-`)) {
        const yearMonth = typeParam.slice(prefix.length + 1);
        if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
          throw new Response('Not Found', { status: 404 });
        }
        const items = await fetchByMonth(yearMonth);
        if (items.length === 0) throw new Response('Not Found', { status: 404 });
        const entries = items
          .map(item => buildUrlEntry(toUrl(item as never), item.updatedAt, 'weekly', 0.7))
          .join('\n');
        return buildSitemapXml(entries);
      }
    }

    // --- Search-index based sitemaps ---
    const parsed = parseSearchType(typeParam);
    if (!parsed) {
      throw new Response('Not Found', { status: 404 });
    }

    const { entityType, startsWith } = parsed;
    const { documents } = await client.search.documents.query({
      type: entityType,
      startsWith,
    });

    const entries = documents
      .map(doc => {
        if (doc.entityType !== entityType) return '';
        const url = `${baseUrl}${urlGenerators[doc.entityType](doc.name, doc.id)}`;
        return buildUrlEntry(url, doc.indexedAt, 'monthly', entityPriorities[doc.entityType]);
      })
      .filter(Boolean)
      .join('\n');

    if (!entries) throw new Response('Not Found', { status: 404 });
    return buildSitemapXml(entries);
  } catch (error) {
    if (error instanceof Response) throw error;
    console.error('Error generating sitemap:', error);

    return new Response(emptySitemap, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600',
      },
    });
  }
};
