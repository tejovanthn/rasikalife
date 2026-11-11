import { createClient } from '@openauthjs/openauth/client';
import { Auth } from '@rasika/core';
import type { AppRouter } from '@rasika/trpc';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createCookieSessionStorage, data, redirect } from 'react-router';
import { Resource } from 'sst';
import { isModeratorRole } from './gate';

/**
 * The same `rasika_session` cookie as rasika.life and classes.rasika.life: same name, same
 * secret, same `Domain`. See `packages/classes/app/lib/auth.server.ts` for why the domain is the
 * load-bearing part. `SESSION_COOKIE_DOMAIN` is set by `infra/admin.ts`.
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
  clientID: 'rasika-admin',
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

export interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
}

function loginRedirect(request: Request): never {
  const url = new URL(request.url);
  const params = new URLSearchParams([['redirectTo', url.pathname + url.search]]);
  throw redirect(`/auth/login?${params}`);
}

/** Verified token, then the profile (the role lives there). One resolution per request. */
const userByRequest = new WeakMap<Request, Promise<AdminUser | null>>();

export function getUser(request: Request): Promise<AdminUser | null> {
  const cached = userByRequest.get(request);
  if (cached) return cached;
  const resolving = resolveUser(request);
  userByRequest.set(request, resolving);
  return resolving;
}

async function resolveUser(request: Request): Promise<AdminUser | null> {
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
    return { id: user.id, email: user.email, name: user.name, role: user.role };
  } catch {
    return null;
  }
}

/**
 * Every route in this app calls this first. Signed out goes to sign-in. Signed in without the
 * moderator or admin role gets a plain 403, which the root error boundary renders as a refusal.
 *
 * This is a convenience gate: the tRPC procedures behind each loader and action are
 * `moderatorProcedure` and refuse the call themselves. Nothing here is the access control.
 */
export async function requireModerator(request: Request): Promise<AdminUser> {
  const user = await getUser(request);
  if (!user) loginRedirect(request);
  if (!isModeratorRole(user.role)) {
    throw data({ reason: 'forbidden' }, { status: 403 });
  }
  return user;
}
