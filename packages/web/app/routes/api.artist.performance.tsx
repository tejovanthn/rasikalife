import type { ActionFunction, LoaderFunction } from 'react-router';
import { data } from 'react-router';
import { createServerClient } from '~/api.server';
import { requireModerator } from '~/lib/auth.server';
import { readOptionalInt } from '~/lib/form-fields';

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
  const intent = formData.get('intent') as string;
  const artistId = ((formData.get('artistId') as string) || '').trim();

  if (!artistId) {
    return data({ error: 'Missing artist' }, { status: 400 });
  }

  const serverClient = await createServerClient(request);

  // Record a known performance directly, tagging this artist. Unlike the poster
  // flow, this is a single event the moderator already knows about; the server
  // creates it, approves it, and features the artist's participation.
  if (intent === 'create') {
    const artistName = ((formData.get('artistName') as string) || '').trim();
    const title = ((formData.get('title') as string) || '').trim();
    const date = ((formData.get('date') as string) || '').trim();
    if (!artistName || !title || !date) {
      return data({ error: 'Title and date are required' }, { status: 400 });
    }
    // Anchor a date-only input at MIDDAY IST, not midnight. Midnight IST is
    // 18:30 the previous UTC day, and the display paths slice the UTC string —
    // so the performance would show up a day early, and worse, render one day
    // on the UTC SSR Lambda and another in the IST browser. Noon IST is 06:30
    // UTC: the same calendar day in both zones, month boundaries included.
    const parsed = new Date(`${date}T12:00:00+05:30`);
    if (Number.isNaN(parsed.getTime())) {
      return data({ error: 'Invalid date' }, { status: 400 });
    }
    const startDateTime = parsed.toISOString();
    const venueName = ((formData.get('venueName') as string) || '').trim() || undefined;
    const role = ((formData.get('role') as string) || '').trim() || undefined;

    try {
      const performance = await serverClient.event.createPerformance.mutate({
        title,
        startDateTime,
        venueName,
        artistId,
        artistName,
        role,
        featured: true,
      });
      return data({ success: true, created: performance });
    } catch (error) {
      console.error('Failed to create performance:', error);
      const message = error instanceof Error ? error.message : 'Failed to create performance';
      return data({ error: message }, { status: 400 });
    }
  }

  const eventId = ((formData.get('eventId') as string) || '').trim();
  if (!eventId) {
    return data({ error: 'Missing event' }, { status: 400 });
  }

  const featured = formData.get('featured') === 'true';
  // parseInt read a prefix, so a rank of '2.7' arrived as 2 and '0' collapsed to undefined.
  // readOptionalInt rejects the first and keeps the second.
  const featureRank = readOptionalInt(formData, 'featureRank');

  // The router's schema floors the rank at 1. Catching it here turns a stringified Zod
  // issues array into something a moderator can read, since the rank box is submitted on
  // blur and never passes through the browser's min= validation.
  if (featureRank !== undefined && featureRank < 1) {
    return data({ error: 'Rank must be 1 or higher' }, { status: 400 });
  }

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
