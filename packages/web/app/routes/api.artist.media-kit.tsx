import type { ActionFunction, LoaderFunction } from 'react-router';
import { data } from 'react-router';
import { createServerClient } from '~/api.server';
import { requireUser } from '~/lib/auth.server';

// Backs the "Media kit" panel on the artist profile.
//
// requireUser, not requireModerator: a media kit is for whoever needs copy — the artist, a
// sabha programmer, a festival. Signed-in is the line because a miss costs a model call, and an
// anonymous page must not be able to spend anything. Beyond that the cache is keyed on a hash
// of the artist's own facts, so however many people ask, it generates once per version of the
// data.
export const loader: LoaderFunction = () => {
  return new Response('Method Not Allowed', { status: 405 });
};

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== 'POST') {
    return data({ error: 'Method not allowed' }, { status: 405 });
  }

  await requireUser(request);

  const formData = await request.formData();
  const artistId = ((formData.get('artistId') as string) || '').trim();
  if (!artistId) {
    return data({ error: 'Missing artist' }, { status: 400 });
  }

  const serverClient = await createServerClient(request);

  try {
    const kit = await serverClient.artist.mediaKit.mutate({
      artistId,
      // A regenerate is an explicit ask — the facts are unchanged, so the hash would otherwise
      // serve the same copy back. It exists because prose is a matter of taste and the first
      // attempt may simply read badly.
      regenerate: formData.get('regenerate') === 'true',
    });
    return data({ success: true, kit });
  } catch (error) {
    console.error('Failed to build media kit:', error);
    const message = error instanceof Error ? error.message : 'Could not build a media kit';
    return data({ error: message }, { status: 400 });
  }
};
