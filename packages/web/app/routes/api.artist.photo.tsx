import type { ActionFunction, LoaderFunction } from 'react-router';
import { data } from 'react-router';
import { createServerClient } from '~/api.server';
import { requireModerator } from '~/lib/auth.server';
import { readClearableField, readOptionalInt } from '~/lib/form-fields';
import { GALLERY_EDITOR_PAGE_SIZE } from '~/lib/gallery-order';

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

  // Several photos in one request. Not a loop of the single `add` on the client: each add
  // needs an `order` one past the last, and N parallel requests would each read the same
  // starting point and collide. Assigning them here, in sequence, is the only place that can
  // be right.
  if (intent === 'addMany') {
    const raw = (formData.get('photos') as string) || '';
    let incoming: Array<{ imageUrl: string; uploadId: string; width?: number; height?: number }>;
    try {
      incoming = JSON.parse(raw);
    } catch {
      return data({ error: 'Malformed upload batch' }, { status: 400 });
    }
    if (!Array.isArray(incoming) || incoming.length === 0) {
      return data({ error: 'Nothing to add' }, { status: 400 });
    }

    const startOrder = readOptionalInt(formData, 'startOrder') ?? 0;
    const added = [];
    const failed: string[] = [];
    for (const [i, item] of incoming.entries()) {
      if (!item?.imageUrl || !item?.uploadId) {
        failed.push('an image with no upload reference');
        continue;
      }
      try {
        added.push(
          await serverClient.artist.addPhoto.mutate({
            artistId,
            imageUrl: item.imageUrl,
            uploadId: item.uploadId,
            width: item.width,
            height: item.height,
            order: startOrder + i,
          })
        );
      } catch (error) {
        console.error('Failed to add photo in batch:', error);
        failed.push(item.imageUrl);
      }
    }

    // Partial success is reported as such rather than thrown away: photos that landed are
    // returned so the grid shows them, and the count that did not is the caller's to surface.
    return data({ success: true, photos: added, failedCount: failed.length });
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

  // One request for the whole move, not one per row. Reordering can touch more than two rows
  // (computePhotoReorder renumbers past duplicate `order` values), and firing them as separate
  // requests meant a partial failure left the moderator's screen and the table disagreeing.
  // The reply always carries what is actually stored, so the client never has to guess.
  if (intent === 'reorder') {
    const raw = ((formData.get('changes') as string) || '').trim();
    let changes: { id: string; order: number }[];
    try {
      changes = JSON.parse(raw);
    } catch {
      return data({ error: 'Malformed reorder' }, { status: 400 });
    }
    if (!Array.isArray(changes) || changes.length === 0) {
      return data({ error: 'Nothing to reorder' }, { status: 400 });
    }

    const results = await Promise.allSettled(
      changes.map(change =>
        serverClient.artist.updatePhoto.mutate({
          artistId,
          id: change.id,
          patch: { order: change.order },
        })
      )
    );
    const failed = results.filter(result => result.status === 'rejected');
    for (const result of failed) {
      console.error('Failed to reorder photo:', (result as PromiseRejectedResult).reason);
    }

    const current = await serverClient.artist.listPhotos.query({
      artistId,
      limit: GALLERY_EDITOR_PAGE_SIZE,
    });
    if (failed.length > 0) {
      return data(
        { error: 'Some photos could not be reordered', photos: current.items },
        { status: 500 }
      );
    }
    return data({ success: true, photos: current.items });
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
