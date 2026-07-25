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

    const serverClient = await createServerClient(request);

    // The accepted entity types are this object's keys, so adding a fourth is
    // one edit rather than two lists kept in step.
    const uploaders = {
      venue: serverClient.venue.getImageUploadUrl,
      organiser: serverClient.organiser.getImageUploadUrl,
      artist: serverClient.artist.getImageUploadUrl,
    };

    // Object.hasOwn, not a truthy check on the lookup: `entityType=constructor`
    // (or any prototype member) would otherwise resolve to an inherited function,
    // slip past the guard, then throw on `.mutate` and return a 500 instead of 400.
    const uploader = Object.hasOwn(uploaders, entityType)
      ? uploaders[entityType as keyof typeof uploaders]
      : undefined;
    if (!uploader) {
      return data({ error: 'Invalid entity type' }, { status: 400 });
    }

    return data(await uploader.mutate({ fileName, contentType }));
  } catch (error) {
    console.error('Failed to get image upload URL:', error);
    return data({ error: 'Failed to get upload URL' }, { status: 500 });
  }
};
