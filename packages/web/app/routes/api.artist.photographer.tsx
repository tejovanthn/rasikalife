import type { ActionFunction, LoaderFunction } from 'react-router';
import { data } from 'react-router';
import { createServerClient } from '~/api.server';
import { requireModerator } from '~/lib/auth.server';

// Resolves a photographer's name to an Artist record, creating an unlisted one on a miss.
// Photographers are Artist rows so they get the shared dedup helper and the byName GSI; the
// unlisted flag keeps them out of the artist index and the search corpus.
export const loader: LoaderFunction = () => {
  return new Response('Method Not Allowed', { status: 405 });
};

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== 'POST') {
    return data({ error: 'Method not allowed' }, { status: 405 });
  }

  await requireModerator(request);

  const formData = await request.formData();
  const name = ((formData.get('name') as string) || '').trim();
  if (!name) {
    return data({ error: 'A name is required' }, { status: 400 });
  }

  try {
    const serverClient = await createServerClient(request);
    const photographer = await serverClient.artist.resolvePhotographer.mutate({ name });
    return data({ success: true, id: photographer.id, name: photographer.name });
  } catch (error) {
    console.error('Failed to resolve photographer:', error);
    const message = error instanceof Error ? error.message : 'Could not resolve that name';
    return data({ error: message }, { status: 400 });
  }
};
