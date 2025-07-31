import type { ActionFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { client } from '~/api.server';

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const entityId = formData.get('entityId')?.toString();
    const entityType = formData.get('entityType')?.toString();
    const action = formData.get('action')?.toString();

    if (!entityId || !entityType || action !== 'trackView') {
      return json({ error: 'Invalid request' }, { status: 400 });
    }

    // Track the view via tRPC by calling getById with trackView: true
    let result;
    switch (entityType) {
      case 'composition':
        result = await client.composition.getById({ id: entityId, trackView: true });
        break;
      case 'artist':
        result = await client.artist.getById({ id: entityId, trackView: true });
        break;
      case 'raga':
        result = await client.raga.getById({ id: entityId, trackView: true });
        break;
      case 'tala':
        result = await client.tala.getById({ id: entityId, trackView: true });
        break;
      default:
        return json({ error: 'Unsupported entity type' }, { status: 400 });
    }

    return json(
      {
        success: true,
        viewCount: result.viewCount,
      },
      {
        headers: {
          'Cache-Control': 'no-cache',
        },
      }
    );
  } catch (error) {
    console.error('Error tracking view:', error);
    return json({ error: 'Failed to track view' }, { status: 500 });
  }
};
