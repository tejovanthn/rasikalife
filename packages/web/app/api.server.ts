import type { AppRouter } from '@rasika/trpc';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { Resource } from 'sst';

export type { RouterOutput } from '@rasika/trpc';

export const client = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: Resource.RasikaTRPC.url,
    }),
  ],
});
