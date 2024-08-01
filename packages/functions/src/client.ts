import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { Resource } from 'sst';

import type { Router } from './index';

const client = createTRPCClient<Router>({
  links: [
    httpBatchLink({
      url: Resource.RasikaTRPC.url,
    }),
  ],
});

export async function handler() {
  return {
    statusCode: 200,
    body: {
      timestamp: new Date().getTime(),
      ...(await client.songsByRaga.query({ raga: 'aa' })),
    },
  };
}
