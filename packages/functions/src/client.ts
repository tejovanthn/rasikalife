import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { Resource } from 'sst';

import type { Router } from './trpc';

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
    body: await client.song.query({ name: 'aadip-paramporuLin' }),
  };
}
