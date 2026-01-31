import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { authClient, getSession, commitSession } from '~/lib/auth.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  // Check for error from OpenAuth
  const error = url.searchParams.get('error');
  if (error) {
    // Clear PKCE challenge so user can retry
    const session = await getSession(request);
    session.unset('pkce_challenge');
    session.unset('pkce_timestamp');
    return redirect(`/?error=${error}`, {
      headers: {
        'Set-Cookie': await commitSession(session),
      },
    });
  }

  if (!code) {
    return redirect('/?error=no_code');
  }

  // Get PKCE challenge from session
  const session = await getSession(request);
  const pkceChallenge = session.get('pkce_challenge') as string;
  const processedCode = session.get('processed_code') as string;

  // Check if this code was already processed (prevent duplicate processing)
  if (processedCode === code) {
    return redirect('/');
  }

  if (!pkceChallenge) {
    return redirect('/?error=invalid_session');
  }

  // Parse PKCE challenge
  const challenge = JSON.parse(pkceChallenge) as { state: string; verifier?: string };

  // Validate state matches what we stored (prevents cross-flow confusion)
  // See: docs/troubleshooting/auth-invalid-grant.md
  if (state && challenge.state !== state) {
    // This is likely a stale callback from a previous flow - restart login
    return redirect('/auth/login');
  }

  try {
    const callbackUrl = `${url.origin}/auth/callback`;
    const exchanged = await authClient.exchange(code, callbackUrl, challenge.verifier);

    if (exchanged.err) {
      return redirect('/?error=exchange_failed');
    }

    // Store tokens in session, mark code as processed, and clear PKCE challenge
    session.set('access_token', exchanged.tokens.access);
    session.set('refresh_token', exchanged.tokens.refresh);
    session.set('processed_code', code);
    session.unset('pkce_challenge');
    session.unset('pkce_timestamp');

    // Redirect to home page after successful auth
    return redirect('/', {
      headers: {
        'Set-Cookie': await commitSession(session),
      },
    });
  } catch {
    return redirect('/?error=unexpected');
  }
}
