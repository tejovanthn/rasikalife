import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { authClient, commitSession, getSession } from '~/lib/auth.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const callbackUrl = `${url.origin}/auth/callback`;

  // Check if there's already a pending auth flow (within last 2 minutes)
  // This prevents race conditions from multiple overlapping login attempts
  // See: docs/troubleshooting/auth-invalid-grant.md
  const session = await getSession(request);
  const existingChallenge = session.get('pkce_challenge') as string;
  const challengeTimestamp = session.get('pkce_timestamp') as number;

  if (existingChallenge && challengeTimestamp) {
    const age = Date.now() - challengeTimestamp;
    if (age < 120000) {
      // Less than 2 minutes old - block new attempts to prevent race conditions
      return redirect('/?error=auth_in_progress');
    }
  }

  // Generate authorize URL with PKCE
  const { url: authUrl, challenge } = await authClient.authorize(callbackUrl, 'code', {
    pkce: true,
  });

  // Store PKCE challenge in session with timestamp
  session.set('pkce_challenge', JSON.stringify(challenge));
  session.set('pkce_timestamp', Date.now());

  return redirect(authUrl, {
    headers: {
      'Set-Cookie': await commitSession(session),
    },
  });
}
