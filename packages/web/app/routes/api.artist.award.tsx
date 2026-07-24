import type { ActionFunction, LoaderFunction } from 'react-router';
import { data } from 'react-router';
import { createServerClient } from '~/api.server';
import { requireModerator } from '~/lib/auth.server';

// Backs the moderator wizard's awards section. Like membership, these land
// immediately in the ArtistAward junction — no draft, no Publish. Adding
// resolves the typed award name to a real award first (create-on-miss), since
// addArtistAward links by awardId.
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

  if (intent === 'add') {
    const artistName = ((formData.get('artistName') as string) || '').trim();
    const awardName = ((formData.get('awardName') as string) || '').trim();
    if (!artistName || !awardName) {
      return data({ error: 'Missing award name' }, { status: 400 });
    }
    const yearRaw = ((formData.get('year') as string) || '').trim();
    const year = yearRaw ? Number.parseInt(yearRaw, 10) || undefined : undefined;
    const category = ((formData.get('category') as string) || '').trim() || undefined;
    const notes = ((formData.get('notes') as string) || '').trim() || undefined;

    try {
      const award = await serverClient.award.resolveOrCreate.mutate({ name: awardName });
      const row = await serverClient.artist.addAward.mutate({
        artistId,
        artistName,
        awardId: award.id,
        awardName: award.name,
        year,
        category,
        notes,
      });
      return data({ success: true, award: row });
    } catch (error) {
      console.error('Failed to add award:', error);
      const message = error instanceof Error ? error.message : 'Failed to add award';
      return data({ error: message }, { status: 400 });
    }
  }

  if (intent === 'remove') {
    const awardId = ((formData.get('awardId') as string) || '').trim();
    if (!awardId) {
      return data({ error: 'Missing award' }, { status: 400 });
    }
    try {
      await serverClient.artist.removeAward.mutate({ artistId, awardId });
      return data({ success: true, awardId });
    } catch (error) {
      console.error('Failed to remove award:', error);
      const message = error instanceof Error ? error.message : 'Failed to remove award';
      return data({ error: message }, { status: 400 });
    }
  }

  return data({ error: 'Invalid intent' }, { status: 400 });
};
