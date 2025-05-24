import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
import { Resource } from 'sst';

import type { AppRouter } from './index';

const client = createTRPCProxyClient<AppRouter>({
  links: [
    httpBatchLink({
      url: Resource.RasikaTRPC.url,
      // You can pass any HTTP headers you wish here
      // async headers() {
      //   return {
      //     authorization: getAuthCookie(),
      //   };
      // },
    }),
  ],
});

export async function handler() {
  return {
    statusCode: 200,
    body: {
      timestamp: new Date().getTime(),
      ...(await client.composition.getById.query({ id: '1' })),
    },
  };
}
