import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { authClient, getSession, commitSession } from '~/lib/auth.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);

  // Check for error from OpenAuth
  const error = url.searchParams.get('error');
  if (error) {
    console.error(
      '[auth.callback] OpenAuth error:',
      error,
      url.searchParams.get('error_description')
    );
    return redirect(`/?error=${error}`);
  }

  const code = url.searchParams.get('code');

  if (!code) {
    console.error('[auth.callback] No code provided');
    return redirect('/?error=no_code');
  }

  // Get PKCE challenge from session
  const session = await getSession(request);
  const pkceChallenge = session.get('pkce_challenge') as string;

  if (!pkceChallenge) {
    console.error('[auth.callback] PKCE challenge not found in session');
    return redirect('/?error=invalid_session');
  }

  try {
    const callbackUrl = `${url.origin}/auth/callback`;

    // Parse PKCE challenge and extract the verifier
    const challenge = JSON.parse(pkceChallenge) as { state: string; verifier?: string };
    const exchanged = await authClient.exchange(code, callbackUrl, challenge.verifier);

    if (exchanged.err) {
      console.error('[auth.callback] Token exchange error:', exchanged.err);
      return redirect('/?error=exchange_failed');
    }

    // Store tokens in session and clear PKCE challenge
    session.set('access_token', exchanged.tokens.access);
    session.set('refresh_token', exchanged.tokens.refresh);
    session.unset('pkce_challenge');

    // Redirect to home page after successful auth
    return redirect('/', {
      headers: {
        'Set-Cookie': await commitSession(session),
      },
    });
  } catch (err) {
    console.error('[auth.callback] Unexpected error:', err);
    return redirect('/?error=unexpected');
  }
}
