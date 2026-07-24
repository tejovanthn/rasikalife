import type { LoaderFunction } from 'react-router';
import { data } from 'react-router';
import { client } from '~/api.server';

// Live DB search backing the moderator find-or-create artist picker
// (SearchSelect). Unlike api.search.artist.tsx, which reads the Fuse index in
// S3, this hits the table directly so a just-created artist is findable
// straight away rather than waiting out the index's 5-minute reindex
// throttle.
export const loader: LoaderFunction = async ({ request }) => {
  const url = new URL(request.url);
  const query = url.searchParams.get('q')?.trim();

  if (!query) {
    return data([]);
  }

  try {
    const result = await client.artist.searchLive.query({ query });

    // No Cache-Control: unlike the Fuse-backed routes, freshness is the whole
    // point of this endpoint, so nothing here should be cacheable.
    return data(result, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('Live artist search error:', error);
    return data([]);
  }
};
