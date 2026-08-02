import { createClient } from '@openauthjs/openauth/client';
import { Auth } from '@rasika/core';
import type { AppRouter } from '@rasika/trpc';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createCookieSessionStorage, redirect } from 'react-router';
import { Resource } from 'sst';

/**
 * The **same** session as rasika.life, read from the same cookie.
 *
 * Name, secret and domain all have to match `packages/web/app/lib/auth.server.ts` or this is a
 * second auth system wearing the first one's clothes. The domain is the load-bearing part: a
 * cookie with no `Domain` attribute is host-only, so a session created on `rasika.life` never
 * reaches `classes.rasika.life` and every visitor here looks signed out. Both apps read
 * `SESSION_COOKIE_DOMAIN`, which infra sets from the stage root.
 *
 * The secret is the shared default rather than a generated one, matching web. It is worth
 * knowing that this means the signing key is a literal in the repository — the practical impact
 * is limited, because the cookie carries an OpenAuth access token that is verified with real
 * crypto on every request, so forging the cookie gets an attacker a forged envelope around a
 * token they still cannot mint. Worth fixing, but not by this project alone: changing it signs
 * everybody out of both apps at once.
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
  clientID: 'rasika-classes',
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
  picture?: string;
}

export async function getUser(request: Request): Promise<SessionUser | null> {
  const tokens = await getTokens(request);
  if (!tokens) {
    return null;
  }

  try {
    const verified = await authClient.verify(Auth.subjects, tokens.access, {
      refresh: tokens.refresh,
    });
    if (verified.err || !verified.subject?.properties.userID) {
      return null;
    }

    const trpc = createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: Resource.RasikaTRPC.url,
          headers: () => ({ Authorization: `Bearer ${tokens.access}` }),
        }),
      ],
    });
    const user = await trpc.user.me.query();
    if (!user) {
      return null;
    }

    // No `role`. Authorisation in this app is membership, never role: a student signs in and
    // stays `editor`, the ordinary default, and what they may see is decided by whether an
    // access row exists. Carrying the role here would invite someone to branch on it.
    return { id: user.id, email: user.email, name: user.name, picture: user.picture };
  } catch {
    return null;
  }
}

export async function requireUser(request: Request): Promise<SessionUser> {
  const user = await getUser(request);
  if (!user) {
    const url = new URL(request.url);
    const params = new URLSearchParams([['redirectTo', url.pathname + url.search]]);
    throw redirect(`/auth/login?${params}`);
  }
  return user;
}
