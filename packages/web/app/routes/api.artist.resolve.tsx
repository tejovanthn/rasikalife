import type { ActionFunction, LoaderFunction } from 'react-router';
import { data } from 'react-router';
import { createServerClient } from '~/api.server';
import { requireModerator } from '~/lib/auth.server';

// Backs the moderator wizard's guru picker: a typed name with no match in
// SearchSelect's results resolves here to a real artist id via find-or-create
// dedup, so the guru row that gets published always carries an id rather than
// a bare name string.
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
    return data({ error: 'Name is required' }, { status: 400 });
  }

  try {
    const serverClient = await createServerClient(request);
    const result = await serverClient.artist.resolveOrCreate.mutate({ name });
    return data(result);
  } catch (error) {
    console.error('Failed to resolve artist name:', error);
    return data({ error: 'Failed to resolve artist name' }, { status: 500 });
  }
};
