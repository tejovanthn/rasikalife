import { createClient } from '@openauthjs/openauth/client';
import { Auth } from '@rasika/core';
import type { AppRouter } from '@rasika/trpc';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createCookieSessionStorage, redirect } from 'react-router';
import { Resource } from 'sst';

/**
 * The same `rasika_session` cookie as rasika.life, classes.rasika.life and admin.rasika.life:
 * same name, same secret, same `Domain`. See `packages/classes/app/lib/auth.server.ts` for why
 * the domain is the load-bearing part. `SESSION_COOKIE_DOMAIN` is set by `infra/sabha.ts`.
 */
const sessionSecret = process.env.SESSION_SECRET || 'dev-secret-change-in-production';

function sessionCookieDomain(): string | undefined {
  const configured = process.env.SESSION_COOKIE_DOMAIN;
  return configured ? `.${configured.replace(/^\./, '')}` : undefined;
}

const storage = createCookieSessionStorage({
  cookie: {
    name: 'rasika_session',
    secure: process.env.NODE_ENV === 'production',
    secrets: [sessionSecret],
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
    domain: sessionCookieDomain(),
  },
});

export const authClient = createClient({
  clientID: 'rasika-sabha',
  issuer: Resource.RasikaAuth.url,
});

export async function getSession(request: Request) {
  return storage.getSession(request.headers.get('Cookie'));
}

export async function commitSession(session: Awaited<ReturnType<typeof getSession>>) {
  return storage.commitSession(session);
}

export async function clearTokens(request: Request): Promise<string> {
  const session = await getSession(request);
  session.unset('access_token');
  session.unset('refresh_token');
  return storage.destroySession(session);
}

export async function getTokens(
  request: Request
): Promise<{ access: string; refresh: string } | null> {
  const session = await getSession(request);
  const access = session.get('access_token') as string;
  const refresh = session.get('refresh_token') as string;
  return access && refresh ? { access, refresh } : null;
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
}

/** One resolution per request, however many loaders ask for it. */
const userByRequest = new WeakMap<Request, Promise<SessionUser | null>>();

export function getUser(request: Request): Promise<SessionUser | null> {
  const cached = userByRequest.get(request);
  if (cached) return cached;
  const resolving = resolveUser(request);
  userByRequest.set(request, resolving);
  return resolving;
}

async function resolveUser(request: Request): Promise<SessionUser | null> {
  const tokens = await getTokens(request);
  if (!tokens) return null;
  try {
    const verified = await authClient.verify(Auth.subjects, tokens.access, {
      refresh: tokens.refresh,
    });
    if (verified.err || !verified.subject?.properties.userID) return null;

    const trpc = createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: Resource.RasikaTRPC.url,
          headers: () => ({ Authorization: `Bearer ${tokens.access}` }),
        }),
      ],
    });
    const user = await trpc.user.me.query();
    if (!user) return null;
    // No role. Authorisation here is membership of the organiser or venue, decided by tRPC
    // (`partnerProcedure`). Carrying the role would invite a route to branch on it.
    return { id: user.id, email: user.email, name: user.name };
  } catch {
    return null;
  }
}

function loginRedirect(request: Request): never {
  const url = new URL(request.url);
  const params = new URLSearchParams([['redirectTo', url.pathname + url.search]]);
  throw redirect(`/auth/login?${params}`);
}

/**
 * Every route calls this first. Signed out goes to sign-in and comes back to the same path and
 * query (the invite link carries the invited address in its query). This only says who the
 * visitor is; what they may open is decided by the tRPC call each loader makes.
 */
export async function requireUser(request: Request): Promise<SessionUser> {
  const user = await getUser(request);
  if (!user) loginRedirect(request);
  return user;
}
