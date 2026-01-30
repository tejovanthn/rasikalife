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

  // If request is provided, get JWT token and include in Authorization header
  if (request) {
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
