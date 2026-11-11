import type { AppRouter } from '@rasika/trpc';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { Resource } from 'sst';
import { getTokens } from './auth.server';

export type { RouterOutput } from '@rasika/trpc';

/**
 * Every read and write goes through a loader or an action, which calls the shared tRPC function
 * from the server with the visitor's bearer token. The browser never calls tRPC, so there is no
 * CORS allowlist and no handler mounted in this app. Same reasoning as Classes and the admin app.
 */
export async function createServerClient(request: Request) {
  const headers: Record<string, string> = {};
  const tokens = await getTokens(request);
  if (tokens?.access) headers.Authorization = `Bearer ${tokens.access}`;
  return createTRPCClient<AppRouter>({
    links: [httpBatchLink({ url: Resource.RasikaTRPC.url, headers: () => headers })],
  });
}

export type ServerClient = Awaited<ReturnType<typeof createServerClient>>;

/**
 * Every venue as `{ id, name, city }`, for the event form's venue list. A few hundred rows, sent
 * once. Follows `nextToken` until it ends, capped so a bad token cannot loop.
 */
export async function loadVenueOptions(
  trpc: ServerClient
): Promise<Array<{ id: string; name: string; city: string | null }>> {
  const out: Array<{ id: string; name: string; city: string | null }> = [];
  let nextToken: string | undefined;
  for (let page = 0; page < 30; page += 1) {
    const result = await trpc.venue.list.query({ limit: 100, nextToken });
    for (const venue of result.items) {
      out.push({ id: venue.id, name: venue.name, city: venue.city ?? null });
    }
    if (!result.nextToken) break;
    nextToken = result.nextToken;
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** The `cause.code` of a tRPC failure that came from core's `ApplicationError`, if any. */
export function errorCode(error: unknown): string | undefined {
  const cause = (error as { cause?: { code?: string } } | undefined)?.cause;
  const data = (error as { data?: { code?: string } } | undefined)?.data;
  return cause?.code ?? data?.code;
}

/** The tRPC HTTP status of a failure, if there is one. */
export function errorStatus(error: unknown): number | undefined {
  return (error as { data?: { httpStatus?: number } } | undefined)?.data?.httpStatus;
}

/** A message safe to show: the tRPC message for a refusal, a plain line for anything else. */
export function errorMessage(error: unknown): string {
  const message = (error as { message?: string } | undefined)?.message;
  return message && message.length < 300 ? message : 'Something went wrong. Try again.';
}
