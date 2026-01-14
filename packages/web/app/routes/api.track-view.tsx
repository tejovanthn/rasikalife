import type { ActionFunction } from 'react-router';
import { data } from 'react-router';
import { client } from '~/api.server';

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== 'POST') {
    return data({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const entityId = formData.get('entityId')?.toString();
    const entityType = formData.get('entityType')?.toString();
    const action = formData.get('action')?.toString();

    if (!entityId || !entityType || action !== 'trackView') {
      return data({ error: 'Invalid request' }, { status: 400 });
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
        return data({ error: 'Unsupported entity type' }, { status: 400 });
    }

    return data(
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
    return data({ error: 'Failed to track view' }, { status: 500 });
  }
};
