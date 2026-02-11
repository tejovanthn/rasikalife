import type { LoaderFunction } from 'react-router';
import { data } from 'react-router';
import { client } from '~/api.server';

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('q');

  if (!query || query.length < 2) {
    return data([]);
  }

  try {
    const result = await client.search.searchTalas.query({ query });

    return data(result.items, {
      headers: {
        'Cache-Control': 'public, max-age=60, s-maxage=60',
      },
    });
  } catch (error) {
    console.error('Tala search error:', error);
    return data([]);
  }
};
