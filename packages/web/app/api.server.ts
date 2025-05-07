import type { Router } from '@rasika/functions';
import { createTRPCClient, httpBatchLink, type inferRouterClient } from '@trpc/client';
import { Resource } from 'sst';

export const client = createTRPCClient<Router>({
  links: [
    httpBatchLink({
      url: Resource.RasikaTRPC.url,
    }),
  ],
});

export type RouterOutput = inferRouterClient<Router>;
