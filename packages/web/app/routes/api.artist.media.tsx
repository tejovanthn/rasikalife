import type { ActionFunction, LoaderFunction } from 'react-router';
import { data } from 'react-router';
import { createServerClient } from '~/api.server';
import { requireModerator } from '~/lib/auth.server';
import { readClearableField } from '~/lib/form-fields';

// Press and media coverage, written immediately like the awards and gallery sections rather
// than waiting for Publish. The wizard's other list editors work the same way.
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

  try {
    if (intent === 'delete') {
      const id = ((formData.get('id') as string) || '').trim();
      if (!id) return data({ error: 'Missing media item' }, { status: 400 });
      await serverClient.artist.deleteMedia.mutate({ artistId, id });
      return data({ success: true, deletedId: id });
    }

    if (intent === 'update') {
      const id = ((formData.get('id') as string) || '').trim();
      if (!id) return data({ error: 'Missing media item' }, { status: 400 });
      // readClearableField keeps "not submitted" apart from "submitted empty", so blanking
      // the outlet removes it rather than being read as "leave alone".
      const media = await serverClient.artist.updateMedia.mutate({
        artistId,
        id,
        patch: {
          title: readClearableField(formData, 'title') || undefined,
          url: readClearableField(formData, 'url') || undefined,
          outlet: readClearableField(formData, 'outlet'),
          publishedOn: readClearableField(formData, 'publishedOn'),
          imageUrl: readClearableField(formData, 'imageUrl'),
        },
      });
      return data({ success: true, media });
    }

    const title = ((formData.get('title') as string) || '').trim();
    const url = ((formData.get('url') as string) || '').trim();
    const mediaType = ((formData.get('mediaType') as string) || '').trim();
    if (!title || !url) {
      return data({ error: 'A title and a link are required' }, { status: 400 });
    }

    const media = await serverClient.artist.addMedia.mutate({
      artistId,
      title,
      url,
      // The Zod enum on the router is what rejects anything that is not a known type; casting
      // here only satisfies the client's own types.
      mediaType: mediaType as 'article' | 'review' | 'interview' | 'video' | 'feature',
      outlet: ((formData.get('outlet') as string) || '').trim() || undefined,
      publishedOn: ((formData.get('publishedOn') as string) || '').trim() || undefined,
      imageUrl: ((formData.get('imageUrl') as string) || '').trim() || undefined,
    });
    return data({ success: true, media });
  } catch (error) {
    console.error('Failed to update artist media:', error);
    const message = error instanceof Error ? error.message : 'Could not save that item';
    return data({ error: message }, { status: 400 });
  }
};
