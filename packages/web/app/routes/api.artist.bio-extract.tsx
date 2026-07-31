import type { ActionFunction, LoaderFunction } from 'react-router';
import { data } from 'react-router';
import { createServerClient } from '~/api.server';
import { requireModerator } from '~/lib/auth.server';

// Backs the wizard's "Extract fields from this bio" button. Unlike the other /api/artist/*
// routes this one writes nothing at all — it returns proposals for the moderator to accept or
// reject in the form, and the ordinary Publish does the writing.
//
// That is what makes it safe to ship before the extractor's precision rate is known: every
// proposal is seen in context, in the form, by the person best placed to reject it.
export const loader: LoaderFunction = () => {
  return new Response('Method Not Allowed', { status: 405 });
};

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== 'POST') {
    return data({ error: 'Method not allowed' }, { status: 405 });
  }

  await requireModerator(request);

  const formData = await request.formData();
  const artistId = ((formData.get('artistId') as string) || '').trim();
  const biography = ((formData.get('biography') as string) || '').trim();

  if (!artistId) {
    return data({ error: 'Missing artist' }, { status: 400 });
  }
  if (!biography) {
    return data(
      { error: 'Write or paste a biography first, then extract from it.' },
      {
        status: 400,
      }
    );
  }

  const serverClient = await createServerClient(request);

  try {
    const proposals = await serverClient.artist.extractFromBio.mutate({ artistId, biography });
    return data({ success: true, proposals });
  } catch (error) {
    console.error('Failed to extract from biography:', error);
    const message = error instanceof Error ? error.message : 'Extraction failed';
    return data({ error: message }, { status: 400 });
  }
};
