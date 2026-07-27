import type { ActionFunction, LoaderFunction } from 'react-router';
import { data } from 'react-router';
import { createServerClient } from '~/api.server';
import { requireModerator } from '~/lib/auth.server';
import { readClearableField, readOptionalInt } from '~/lib/form-fields';

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
    const order = readOptionalInt(formData, 'order');

    try {
      const photo = await serverClient.artist.addPhoto.mutate({
        artistId,
        imageUrl,
        uploadId,
        caption,
        credit,
        order,
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
    // caption/credit distinguish "not submitted" (undefined, preserve) from "submitted
    // empty" (clear) — the `((x as string) || '').trim() || undefined` idiom used in the
    // `add` branch above collapses both to undefined, which means a caption can never be
    // cleared once set. Callers that don't mean to touch a field (e.g. the featured-only
    // toggle) simply omit it from the form so it reads as undefined here too.
    const caption = readClearableField(formData, 'caption');
    const credit = readClearableField(formData, 'credit');
    const order = readOptionalInt(formData, 'order');
    const featuredRaw = formData.get('featured');
    const featured = featuredRaw === null ? undefined : featuredRaw === 'true';

    try {
      const photo = await serverClient.artist.updatePhoto.mutate({
        artistId,
        id,
        patch: { caption, credit, order, featured },
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
