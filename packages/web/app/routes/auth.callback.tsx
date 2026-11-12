import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { authClient, commitSession, getSession } from '~/lib/auth.server';
import { cancelledQrLocation, finishQrIntent } from '~/lib/qr-callback.server';
import { clearQrIntent } from '~/lib/qr-intent.server';
import { safeRedirectPath } from '~/lib/safe-redirect';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  // Check for error from OpenAuth
  const error = url.searchParams.get('error');
  if (error) {
    console.error('[auth.callback] Error from OpenAuth:', error);
    // Clear PKCE challenge so user can retry
    const session = await getSession(request);
    session.unset('pkce_challenge');
    session.unset('pkce_timestamp');
    session.unset('qr_nonce');
    // A scanner who chose things before sign-in goes back to them (qr_intent kept).
    const qrBack = await cancelledQrLocation(request);
    return redirect(qrBack ?? `/?error=${error}`, {
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
      console.error('[auth.callback] Exchange failed:', exchanged.err);
      return redirect('/?error=exchange_failed');
    }

    // Store tokens in session, mark code as processed, and clear PKCE challenge
    session.set('access_token', exchanged.tokens.access);
    session.set('refresh_token', exchanged.tokens.refresh);
    session.set('processed_code', code);
    session.unset('pkce_challenge');
    session.unset('pkce_timestamp');

    // Back to the page that asked for sign-in, else home. Re-checked here: the session value
    // came from a query parameter.
    const back = safeRedirectPath(session.get('post_login_redirect')) ?? '/';
    session.unset('post_login_redirect');

    // A scanner's choices from before sign-in (qr_intent): apply them and land on the end.
    const attemptNonce = session.get('qr_nonce');
    session.unset('qr_nonce');
    const qr = await finishQrIntent(request, exchanged.tokens.access, attemptNonce);
    const headers = new Headers();
    headers.append('Set-Cookie', await commitSession(session));
    // Cleared at the end of every sign-in, applied or not.
    headers.append('Set-Cookie', await clearQrIntent());
    return redirect(qr?.location ?? back, { headers });
  } catch (error) {
    console.error('[auth.callback] Unexpected error:', error);
    return redirect('/?error=unexpected');
  }
}
