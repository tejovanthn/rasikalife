import type { LoaderFunction } from 'react-router';
import { data } from 'react-router';
import { client } from '~/api.server';

export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('q');

  if (!query || query.length < 2) return data([]);

  try {
    const result = await client.search.searchCompositions.query({ query, limit: 8 });
    return data(result.items, {
      headers: { 'Cache-Control': 'public, max-age=30, s-maxage=30' },
    });
  } catch {
    // Return null (not []) so the client can show "unavailable" vs "no results".
    // No cache headers — a 503 must not be cached.
    return data(null, { status: 503 });
  }
};
