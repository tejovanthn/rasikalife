import { createClient } from '@openauthjs/openauth/client';
import { Auth } from '@rasika/core';
import type { AppRouter } from '@rasika/trpc';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createCookieSessionStorage, redirect } from 'react-router';
import { Resource } from 'sst';

const sessionSecret = process.env.SESSION_SECRET || 'dev-secret-change-in-production';

/**
 * The session is shared across every Rasika subdomain, so the cookie has to say so.
 *
 * Without a `Domain` attribute a cookie is *host-only*: set on `rasika.life`, it is never sent
 * to `classes.rasika.life`, and the Classes app would see every visitor as signed out however
 * correct its own code was. A leading dot makes it apply to the domain and everything under it.
 *
 * Production only, and by hostname rather than by stage, because a non-prod stage lives at
 * `dev.rasika.life` and wants `.dev.rasika.life` — pinning the root there would let two stages
 * overwrite each other's sessions. Locally there is no domain to speak of and the cookie stays
 * host-only on `localhost`, which is what a browser wants.
 *
 * Note for the deploy: existing signed-in users hold a host-only cookie of the same name. The
 * browser will send both until the old one expires, and whichever the parser reads first wins.
 * They carry the same session, so the only effect is that the change takes hold on the next
 * sign-in rather than immediately.
 */
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
  clientID: 'rasika-web',
  issuer: Resource.RasikaAuth.url,
});

export async function getSession(request: Request) {
  return storage.getSession(request.headers.get('Cookie'));
}

export async function commitSession(session: Awaited<ReturnType<typeof getSession>>) {
  return storage.commitSession(session);
}

export async function destroySession(session: Awaited<ReturnType<typeof getSession>>) {
  return storage.destroySession(session);
}

/**
 * Cache-Control for a page whose own content is public but which renders inside the root
 * layout — and the root loader puts the signed-in viewer's name and email into every
 * document it produces.
 *
 * This matters because SST's generated CloudFront server cache policy sets
 * `cookieBehavior: "none"`, so `rasika_session` is not part of the cache key. A `public,
 * s-maxage` document produced for a signed-in viewer is therefore stored once and handed to
 * everybody, their email included. Anything public must decide this per request, not
 * declare it statically.
 *
 * The decision reads the session cookie rather than calling `getUser`, which verifies the
 * token and then fetches the user over tRPC — far too expensive to put on an anonymous read
 * path. An expired or invalid cookie costs one cache miss and never a leak, which is the
 * right way round to be wrong.
 */
export const PUBLIC_PAGE_CACHE_CONTROL =
  'public, max-age=0, s-maxage=120, stale-while-revalidate=600';
export const PRIVATE_PAGE_CACHE_CONTROL = 'private, no-cache';

export async function publicPageCacheControl(request: Request): Promise<string> {
  const tokens = await getTokens(request);
  return tokens ? PRIVATE_PAGE_CACHE_CONTROL : PUBLIC_PAGE_CACHE_CONTROL;
}

export async function getTokens(
  request: Request
): Promise<{ access: string; refresh: string } | null> {
  const session = await getSession(request);
  const access = session.get('access_token') as string;
  const refresh = session.get('refresh_token') as string;

  if (!access || !refresh) {
    return null;
  }

  return { access, refresh };
}

export async function setTokens(
  request: Request,
  accessToken: string,
  refreshToken: string
): Promise<string> {
  const session = await getSession(request);
  session.set('access_token', accessToken);
  session.set('refresh_token', refreshToken);
  return commitSession(session);
}

export async function clearTokens(request: Request): Promise<string> {
  const session = await getSession(request);
  session.unset('access_token');
  session.unset('refresh_token');
  return destroySession(session);
}

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  role: (typeof Auth.ROLE)[keyof typeof Auth.ROLE];
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

    if (verified.err || !verified.subject) {
      return null;
    }

    const userId = verified.subject.properties.userID;

    if (!userId) {
      return null;
    }

    // Use tRPC to fetch user data (inline client to avoid circular dependency with api.server.ts)
    const trpc = createTRPCClient<AppRouter>({
      links: [
        httpBatchLink({
          url: Resource.RasikaTRPC.url,
          headers: () => ({
            Authorization: `Bearer ${tokens.access}`,
          }),
        }),
      ],
    });
    const user = await trpc.user.me.query();

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      picture: user.picture,
      role: user.role as SessionUser['role'],
    };
  } catch {
    return null;
  }
}

export async function requireUser(request: Request, redirectTo?: string) {
  const user = await getUser(request);

  if (!user) {
    const url = redirectTo ?? new URL(request.url).pathname;
    const searchParams = new URLSearchParams([['redirectTo', url]]);
    throw redirect(`/auth/login?${searchParams}`);
  }

  return user;
}

export async function requirePermission(request: Request, permission: string, redirectTo?: string) {
  const user = await requireUser(request, redirectTo);

  if (!Auth.can(user.role, permission as Parameters<typeof Auth.can>[1])) {
    throw redirect(redirectTo ?? '/');
  }

  return user;
}

export async function requireRole(
  request: Request,
  role: (typeof Auth.ROLE)[keyof typeof Auth.ROLE],
  redirectTo?: string
) {
  const user = await requireUser(request, redirectTo);

  if (user.role !== role && user.role !== Auth.ROLE.ADMIN) {
    throw redirect(redirectTo ?? '/');
  }

  return user;
}

export async function requireModerator(request: Request) {
  return requireRole(request, Auth.ROLE.MODERATOR);
}

export async function requireAdmin(request: Request) {
  return requireRole(request, Auth.ROLE.ADMIN);
}

export async function logout(request: Request) {
  const session = await getSession(request);
  return redirect('/', {
    headers: {
      'Set-Cookie': await storage.destroySession(session),
    },
  });
}
