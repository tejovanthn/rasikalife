import type { LoaderFunction } from 'react-router';
import { data } from 'react-router';
import { type RouterOutput, client } from '~/api.server';

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('q');
  const type = url.searchParams.get('type') || 'all';
  const limit = Number.parseInt(url.searchParams.get('limit') || '10');

  if (!query || query.length < 2) {
    return data({ error: 'Query must be at least 2 characters' }, { status: 400 });
  }

  try {
    interface SearchResults {
      compositions: Array<{
        id: string;
        title: string;
        type: 'composition';
        url: string;
        raga?: string;
        tala?: string;
      }>;
      artists: Array<{
        id: string;
        name: string;
        type: 'artist';
        url: string;
        artistType?: string;
        traditions?: string[];
      }>;
      ragas: Array<{
        id: string;
        name: string;
        type: 'raga';
        url: string;
        melakarta?: number;
      }>;
      talas: Array<{
        id: string;
        name: string;
        type: 'tala';
        url: string;
        aksharas?: number;
      }>;
    }

    const results: SearchResults = {
      compositions: [],
      artists: [],
      ragas: [],
      talas: [],
    };

    // Search based on type
    if (type === 'all' || type === 'compositions') {
      const compositions = await client.composition.search.query({
        query,
        limit: type === 'compositions' ? limit : Math.min(limit, 3),
      });
      results.compositions = compositions.items.map((item: any) => ({
        id: item.id,
        title: item.title,
        type: 'composition' as const,
        url: `/carnatic/compositions/${item.title.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${item.id}`,
        raga:
          item.ragaIds && item.ragaIds.length > 0
            ? `${item.ragaIds.length} raga${item.ragaIds.length > 1 ? 's' : ''}`
            : undefined,
        tala:
          item.talaIds && item.talaIds.length > 0
            ? `${item.talaIds.length} tala${item.talaIds.length > 1 ? 's' : ''}`
            : undefined,
      }));
    }

    if (type === 'all' || type === 'artists') {
      const artists = await client.artist.search.query({
        query,
        limit: type === 'artists' ? limit : Math.min(limit, 3),
      });
      results.artists = artists.items.map((item: any) => ({
        id: item.id,
        name: item.name,
        type: 'artist' as const,
        url: `/carnatic/artists/${item.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${item.id}`,
        artistType: item.artistType,
        traditions: item.traditions,
      }));
    }

    if (type === 'all' || type === 'ragas') {
      const ragas = await client.raga.search.query({
        query,
        limit: type === 'ragas' ? limit : Math.min(limit, 3),
      });
      results.ragas = ragas.items.map((item: any) => ({
        id: item.id,
        name: item.name,
        type: 'raga' as const,
        url: `/carnatic/ragas/${item.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${item.id}`,
        melakarta: item.melakarta,
      }));
    }

    if (type === 'all' || type === 'talas') {
      const talas = await client.tala.search.query({
        query,
        limit: type === 'talas' ? limit : Math.min(limit, 3),
      });
      results.talas = talas.items.map((item: any) => ({
        id: item.id,
        name: item.name,
        type: 'tala' as const,
        url: `/carnatic/talas/${item.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${item.id}`,
        aksharas: item.aksharas,
      }));
    }

    return data(results, {
      headers: {
        'Cache-Control': 'public, max-age=300', // Cache for 5 minutes
      },
    });
  } catch (error) {
    console.error('Search API error:', error);
    return data({ error: 'Search failed' }, { status: 500 });
  }
};
