import type { ActionFunction, LoaderFunction } from 'react-router';
import { data } from 'react-router';
import { createServerClient } from '~/api.server';
import { requireModerator } from '~/lib/auth.server';

// Backs the moderator wizard's gallery. Photos are their own ArtistPhoto rows,
// so add/update/delete land immediately. The image bytes are uploaded via the
// existing ImageUpload flow first; this only stores the resulting CDN URL.
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
    const imageUrl = ((formData.get('imageUrl') as string) || '').trim();
    const uploadId = ((formData.get('uploadId') as string) || '').trim();
    if (!imageUrl || !uploadId) {
      return data({ error: 'Missing image' }, { status: 400 });
    }
    const caption = ((formData.get('caption') as string) || '').trim() || undefined;
    const credit = ((formData.get('credit') as string) || '').trim() || undefined;

    try {
      const photo = await serverClient.artist.addPhoto.mutate({
        artistId,
        imageUrl,
        uploadId,
        caption,
        credit,
      });
      return data({ success: true, photo });
    } catch (error) {
      console.error('Failed to add photo:', error);
      const message = error instanceof Error ? error.message : 'Failed to add photo';
      return data({ error: message }, { status: 400 });
    }
  }

  if (intent === 'update') {
    const id = ((formData.get('id') as string) || '').trim();
    if (!id) {
      return data({ error: 'Missing photo' }, { status: 400 });
    }
    const caption = ((formData.get('caption') as string) || '').trim() || undefined;
    const credit = ((formData.get('credit') as string) || '').trim() || undefined;
    const orderRaw = ((formData.get('order') as string) || '').trim();
    const order = orderRaw ? Number.parseInt(orderRaw, 10) || undefined : undefined;

    try {
      const photo = await serverClient.artist.updatePhoto.mutate({
        artistId,
        id,
        patch: { caption, credit, order },
      });
      return data({ success: true, photo });
    } catch (error) {
      console.error('Failed to update photo:', error);
      const message = error instanceof Error ? error.message : 'Failed to update photo';
      return data({ error: message }, { status: 400 });
    }
  }

  if (intent === 'delete') {
    const id = ((formData.get('id') as string) || '').trim();
    if (!id) {
      return data({ error: 'Missing photo' }, { status: 400 });
    }
    try {
      await serverClient.artist.deletePhoto.mutate({ artistId, id });
      return data({ success: true, id });
    } catch (error) {
      console.error('Failed to delete photo:', error);
      const message = error instanceof Error ? error.message : 'Failed to delete photo';
      return data({ error: message }, { status: 400 });
    }
  }

  return data({ error: 'Invalid intent' }, { status: 400 });
};
