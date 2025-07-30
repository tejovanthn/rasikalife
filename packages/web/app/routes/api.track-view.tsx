import type { ActionFunction } from '@remix-run/node';
import { json } from '@remix-run/node';
import { client } from '~/api.server';

export const action: ActionFunction = async ({ request }) => {
  if (request.method !== 'POST') {
    return json({ error: 'Method not allowed' }, { status: 405 });
  }

  try {
    const formData = await request.formData();
    const compositionId = formData.get('compositionId')?.toString();
    const action = formData.get('action')?.toString();

    if (!compositionId || action !== 'trackView') {
      return json({ error: 'Invalid request' }, { status: 400 });
    }

    // Track the view via tRPC
    const result = await client.composition.trackView({ id: compositionId });

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
