import type { AppRouter } from '@rasika/trpc';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { Resource } from 'sst';
import { getTokens } from '~/lib/auth.server';

export type { RouterOutput } from '@rasika/trpc';

// Unauthenticated client for public requests
export const client = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: Resource.RasikaTRPC.url,
    }),
  ],
});

// Create authenticated tRPC client for server-side usage (in loaders/actions)
export async function createServerClient(request?: Request) {
  const headers: Record<string, string> = {};

  if (request) {
    // Forward original user-agent and referer so tRPC logs show the actual caller
    const ua = request.headers.get('user-agent');
    const referer = request.headers.get('referer');
    if (ua) headers['user-agent'] = ua;
    if (referer) headers['referer'] = referer;

    try {
      const tokens = await getTokens(request);
      if (tokens?.access) {
        headers.Authorization = `Bearer ${tokens.access}`;
      }
    } catch (error) {
      console.error('Error getting tokens for tRPC client:', error);
    }
  }

  return createTRPCClient<AppRouter>({
    links: [
      httpBatchLink({
        url: Resource.RasikaTRPC.url,
        headers: () => headers,
      }),
    ],
  });
}
