import type { LoaderFunctionArgs } from 'react-router';
import { redirect } from 'react-router';
import { authClient, commitSession, getSession } from '~/lib/auth.server';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const session = await getSession(request);

  const error = url.searchParams.get('error');
  if (error) {
    session.unset('pkce_challenge');
    session.unset('pkce_timestamp');
    return redirect(`/?error=${encodeURIComponent(error)}`, {
      headers: { 'Set-Cookie': await commitSession(session) },
    });
  }

  const code = url.searchParams.get('code');
  if (!code) {
    return redirect('/?error=no_code');
  }

  // The same code arriving twice is a back button or a double-tap, not a failure.
  if (session.get('processed_code') === code) {
    return redirect('/');
  }

  const pkceChallenge = session.get('pkce_challenge') as string;
  if (!pkceChallenge) {
    return redirect('/?error=invalid_session');
  }

  const challenge = JSON.parse(pkceChallenge) as { state: string; verifier?: string };
  const state = url.searchParams.get('state');
  if (state && challenge.state !== state) {
    return redirect('/auth/login');
  }

  try {
    const exchanged = await authClient.exchange(
      code,
      `${url.origin}/auth/callback`,
      challenge.verifier
    );
    if (exchanged.err) {
      console.error('[auth.callback] exchange failed:', exchanged.err);
      return redirect('/?error=exchange_failed');
    }

    session.set('access_token', exchanged.tokens.access);
    session.set('refresh_token', exchanged.tokens.refresh);
    session.set('processed_code', code);
    session.unset('pkce_challenge');
    session.unset('pkce_timestamp');

    const redirectTo = (session.get('redirect_to') as string) ?? '/';
    session.unset('redirect_to');

    return redirect(redirectTo.startsWith('/') ? redirectTo : '/', {
      headers: { 'Set-Cookie': await commitSession(session) },
    });
  } catch (err) {
    console.error('[auth.callback] unexpected error:', err);
    return redirect('/?error=unexpected');
  }
}
