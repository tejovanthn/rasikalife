import { createClient } from '@openauthjs/openauth/client';
import { Auth } from '@rasika/core';
import type { AppRouter } from '@rasika/trpc';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createCookieSessionStorage, redirect } from 'react-router';
import { Resource } from 'sst';

const sessionSecret = process.env.SESSION_SECRET || 'dev-secret-change-in-production';

const storage = createCookieSessionStorage({
  cookie: {
    name: 'rasika_session',
    secure: process.env.NODE_ENV === 'production',
    secrets: [sessionSecret],
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    httpOnly: true,
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
