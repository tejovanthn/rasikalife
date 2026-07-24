import type { LoaderFunction } from 'react-router';
import { data } from 'react-router';
import { client } from '~/api.server';

// Live DB search backing the moderator find-or-create award picker
// (SearchSelect). There is no Fuse-backed api.search.award.tsx to mirror —
// this is the only award search route — but it follows the same shape as
// api.search.artist-live.tsx for consistency.
export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('q')?.trim();

  if (!query) {
    return data([]);
  }

  try {
    const result = await client.award.searchLive.query({ query });

    // No Cache-Control: freshness is the whole point of this endpoint.
    return data(result, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Live award search error:', error);
    return data([]);
  }
};
