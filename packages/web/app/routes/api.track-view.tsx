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

    // Track the view via tRPC by calling get
    // TODO: Re-enable view tracking when supported by backend
    let result: { viewCount: number } | undefined;
    switch (entityType) {
      case 'composition':
        // @ts-ignore - viewCount missing in return type temporarily
        result = await client.composition.get.query({ id: entityId });
        break;
      case 'artist':
        // @ts-ignore - viewCount missing in return type temporarily
        result = await client.artist.get.query({ id: entityId });
        break;
      case 'raga':
        // @ts-ignore - viewCount missing in return type temporarily
        result = await client.raga.get.query({ id: entityId });
        break;
      case 'tala':
        // @ts-ignore - viewCount missing in return type temporarily
        result = await client.tala.get.query({ id: entityId });
        break;
      default:
        return data({ error: 'Unsupported entity type' }, { status: 400 });
    }

    return data(
      {
        success: true,
        viewCount: result?.viewCount || 0,
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
