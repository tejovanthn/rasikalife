import type { LoaderFunction } from 'react-router';
import { data } from 'react-router';
import { client } from '~/api.server';

const RESULTS_PER_TYPE = 5;

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('q');

  if (!query || query.length < 2) {
    return data({ error: 'Query must be at least 2 characters' }, { status: 400 });
  }

  try {
    // Fetch more results to ensure we get enough of each type
    // Results are already sorted by relevance from Fuse.js
    const result = await client.search.search.query({
      query,
      limit: 100,
      offset: 0,
    });

    // Group by type and take top N of each (already sorted by relevance)
    const searchResults = {
      compositions: result.items
        .filter(item => item.type === 'composition')
        .slice(0, RESULTS_PER_TYPE),
      artists: result.items.filter(item => item.type === 'artist').slice(0, RESULTS_PER_TYPE),
      ragas: result.items.filter(item => item.type === 'raga').slice(0, RESULTS_PER_TYPE),
      talas: result.items.filter(item => item.type === 'tala').slice(0, RESULTS_PER_TYPE),
      venues: result.items.filter(item => item.type === 'venue').slice(0, RESULTS_PER_TYPE),
      organisers: result.items.filter(item => item.type === 'organiser').slice(0, RESULTS_PER_TYPE),
      events: result.items.filter(item => item.type === 'event').slice(0, RESULTS_PER_TYPE),
      festivals: result.items.filter(item => item.type === 'festival').slice(0, RESULTS_PER_TYPE),
    };

    return data(searchResults, {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=60',
      },
    });
  } catch (error) {
    console.error('Search error:', error);
    return data({ error: 'Search failed' }, { status: 500 });
  }
};
