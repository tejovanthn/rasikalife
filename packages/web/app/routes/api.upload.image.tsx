import type { ActionFunction, LoaderFunction } from 'react-router';
import { data } from 'react-router';
import { createServerClient } from '~/api.server';
import { getUser } from '~/lib/auth.server';

export const loader: LoaderFunction = () => {
  return new Response('Method Not Allowed', { status: 405 });
};

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== 'POST') {
    return data({ error: 'Method not allowed' }, { status: 405 });
  }

  const user = await getUser(request);
  if (!user) {
    return data({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const entityType = formData.get('entityType') as string;
    const fileName = formData.get('fileName') as string;
    const contentType = formData.get('contentType') as string;

    if (!entityType || !fileName || !contentType) {
      return data({ error: 'Missing required fields' }, { status: 400 });
    }

    if (entityType !== 'venue' && entityType !== 'organiser' && entityType !== 'artist') {
      return data({ error: 'Invalid entity type' }, { status: 400 });
    }

    const serverClient = await createServerClient(request);

    const uploaders = {
      venue: serverClient.venue.getImageUploadUrl,
      organiser: serverClient.organiser.getImageUploadUrl,
      artist: serverClient.artist.getImageUploadUrl,
    } as const;

    const result = await uploaders[entityType].mutate({ fileName, contentType });

    return data(result);
  } catch (error) {
    console.error('Failed to get image upload URL:', error);
    return data({ error: 'Failed to get upload URL' }, { status: 500 });
  }
};
