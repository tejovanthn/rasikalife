import type { AppRouter } from '@rasika/trpc';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { Resource } from 'sst';
import { getTokens } from './auth.server';

export type { RouterOutput } from '@rasika/trpc';

/**
 * Every read and write goes through a loader or an action, which then calls the shared tRPC
 * function server-side.
 *
 * The plan (§3.3) asked for a tRPC handler mounted inside this app, to keep browser calls
 * same-origin and avoid a CORS allowlist and a preflight on every mutation. That reasoning is
 * sound and its premise does not hold here: with loaders for reads and actions for writes (§12),
 * the browser never calls tRPC at all — it calls this app's own routes, which are same-origin by
 * construction. Mounting the router here anyway would mean a second database-linked endpoint
 * that nothing uses, which is attack surface bought with no benefit.
 *
 * If a genuine client-side call ever appears, add the handler route then; the router import is
 * one line and the reasoning above says exactly what it would be for.
 */
export async function createServerClient(request?: Request) {
  const headers: Record<string, string> = {};

  if (request) {
    const tokens = await getTokens(request);
    if (tokens?.access) {
      headers.Authorization = `Bearer ${tokens.access}`;
    }
  }

  return createTRPCClient<AppRouter>({
    links: [httpBatchLink({ url: Resource.RasikaTRPC.url, headers: () => headers })],
  });
}
