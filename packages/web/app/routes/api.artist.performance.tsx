import type { ActionFunction, LoaderFunction } from 'react-router';
import { data } from 'react-router';
import { createServerClient } from '~/api.server';
import { requireModerator } from '~/lib/auth.server';

// Toggles the per-artist "featured" flag on an event the artist already
// performed at. Immediate write, like the other Recognition sections — it does
// not create or link events, only marks an existing participation as a career
// highlight for the profile's notable-past teaser.
export const loader: LoaderFunction = () => {
  return new Response('Method Not Allowed', { status: 405 });
};

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== 'POST') {
    return data({ error: 'Method not allowed' }, { status: 405 });
  }

  await requireModerator(request);

  const formData = await request.formData();
  const eventId = ((formData.get('eventId') as string) || '').trim();
  const artistId = ((formData.get('artistId') as string) || '').trim();

  if (!eventId || !artistId) {
    return data({ error: 'Missing event or artist' }, { status: 400 });
  }

  const featured = formData.get('featured') === 'true';
  const rankRaw = ((formData.get('featureRank') as string) || '').trim();
  const featureRank = rankRaw ? Number.parseInt(rankRaw, 10) || undefined : undefined;

  const serverClient = await createServerClient(request);

  try {
    const row = await serverClient.artist.setFeaturedPerformance.mutate({
      eventId,
      artistId,
      featured,
      featureRank,
    });
    return data({ success: true, performance: row });
  } catch (error) {
    console.error('Failed to set featured performance:', error);
    const message = error instanceof Error ? error.message : 'Failed to update performance';
    return data({ error: message }, { status: 400 });
  }
};
