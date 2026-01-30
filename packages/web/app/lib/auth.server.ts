import { createClient } from '@openauthjs/openauth/client';
import { authSubjects } from '@rasika/core';
import { createCookieSessionStorage } from 'react-router';
import { Resource } from 'sst';

// Session secret should be set in environment
const sessionSecret = process.env.SESSION_SECRET || 'dev-secret-change-in-production';

// Session storage configuration for tokens
const storage = createCookieSessionStorage({
  cookie: {
    name: 'rasika_session',
    secure: process.env.NODE_ENV === 'production',
    secrets: [sessionSecret],
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
    httpOnly: true,
  },
});

// Create OpenAuth client
export const authClient = createClient({
  clientID: 'rasika-web',
  issuer: Resource.RasikaAuth.url,
});

// Get the session from the request
export async function getSession(request: Request) {
  return storage.getSession(request.headers.get('Cookie'));
}

// Commit the session (save changes)
export async function commitSession(session: Awaited<ReturnType<typeof getSession>>) {
  return storage.commitSession(session);
}

// Destroy the session (logout)
export async function destroySession(session: Awaited<ReturnType<typeof getSession>>) {
  return storage.destroySession(session);
}

// Get tokens from session
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

// Set tokens in session and return cookie header
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

// Clear tokens from session
export async function clearTokens(request: Request): Promise<string> {
  const session = await getSession(request);
  session.unset('access_token');
  session.unset('refresh_token');
  return destroySession(session);
}

// Verify auth and get user subject
export async function verifyAuth(request: Request): Promise<{
  user: { userID: string } | null;
  newTokens?: { access: string; refresh: string };
}> {
  const tokens = await getTokens(request);

  if (!tokens) {
    return { user: null };
  }

  try {
    const verified = await authClient.verify(authSubjects, tokens.access, {
      refresh: tokens.refresh,
    });

    if (verified.err) {
      return { user: null };
    }

    return {
      user: verified.subject.properties,
      newTokens: verified.tokens,
    };
  } catch {
    return { user: null };
  }
}
